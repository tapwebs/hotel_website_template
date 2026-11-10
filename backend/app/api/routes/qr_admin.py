"""QR Hub admin API (staff): organizations, links, placements, offers, bulk actions, JSON export.

Native replacement for the QR Hub admin routes of the old website (Fastify) service, so the HMS QR library no longer
depends on that service. Same paths, JSON shapes and validation rules as `backend/website/src/routes/qr-hub.ts`.
Mounted under /api/v1/website. Analytics and CSV export live in website_admin.py.
"""
import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.routes.qr_hub import get_public_site_url
from backend.app.models.room import Room
from backend.app.api.routes.qr_hub import invalidate_hub_cache
from backend.app.api.routes.website_admin import require_admin
from backend.app.core.database import get_db
from backend.app.models.website import QrClick, QrLink, QrOffer, QrOrganization, QrPlacement, QrVisit
from backend.app.services.website_booking_service import IST_TIMEZONE

router = APIRouter(prefix="/website/qr-hub/admin", tags=["QR Hub Admin"])

CATEGORIES = ("Hotel", "Restaurant / Dining", "Banquet / Weddings", "Rooms", "Events", "Other")
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
HHMM_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no look-alikes (i, l, o, 0, 1)


def _uid_value(v: str) -> str:
    try:
        return str(uuid.UUID(str(v)))
    except ValueError:
        raise ValueError("Invalid id.")


def _uid(v: str) -> str:
    try:
        return _uid_value(v)
    except ValueError:
        raise _err(422, "validation_failed", issues=[{"path": "id", "message": "Invalid id."}])


def _err(status: int, error: str, **extra: Any) -> HTTPException:
    return HTTPException(status_code=status, detail={"error": error, **extra})


# ---- Validation helpers -------------------------------------------------------------------------------------------
def _blank_to_none(v: Any) -> Any:
    return None if v is None or (isinstance(v, str) and not v.strip()) else (v.strip() if isinstance(v, str) else v)


def _url(schemes: tuple, v: Optional[str], max_len: int = 2000) -> Optional[str]:
    v = _blank_to_none(v)
    if v is None:
        return None
    p = urlparse(v)
    if len(v) > max_len or f"{p.scheme}:" not in schemes or (p.scheme in ("http", "https") and not p.netloc):
        raise ValueError("Use a valid URL.")
    return v


def _image(v: Optional[str]) -> Optional[str]:
    v = _blank_to_none(v)
    if v is None:
        return None
    if len(v) > 2000 or not ((v.startswith("/") and not v.startswith("//")) or v.startswith("https://")):
        raise ValueError("Use a /path or an https URL.")
    return v


def _when(v: Any) -> Optional[datetime]:
    if v is None or v == "":
        return None
    try:
        d = datetime.fromisoformat(v.replace("Z", "+00:00")) if isinstance(v, str) else v
    except ValueError:
        raise ValueError("Use an ISO date and time.")
    return (d if d.tzinfo else d.replace(tzinfo=IST_TIMEZONE)).astimezone(timezone.utc)


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Hours(Strict):
    open: str
    close: str

    @field_validator("open", "close")
    @classmethod
    def _hhmm(cls, v: str) -> str:
        if not HHMM_RE.match(v):
            raise ValueError("Use HH:MM.")
        return v


def _text(max_len: int):
    def check(v: Optional[str]) -> Optional[str]:
        v = _blank_to_none(v)
        if v is not None and len(v) > max_len:
            raise ValueError(f"At most {max_len} characters.")
        return v

    return check


class OrgFields(Strict):
    name: Optional[str] = None
    category: Optional[Literal["Hotel", "Restaurant / Dining", "Banquet / Weddings", "Rooms", "Events", "Other"]] = None
    description: Optional[str] = None
    description_hi: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    maps_url: Optional[str] = None
    website_url: Optional[str] = None
    review_url: Optional[str] = None
    profile_image: Optional[str] = None
    logo: Optional[str] = None
    theme: Optional[Dict[str, Any]] = None
    wifi_ssid: Optional[str] = None
    wifi_password: Optional[str] = None
    wifi_visible: Optional[bool] = None
    qr_status: Optional[Literal["active", "inactive", "draft"]] = None
    status: Optional[Literal["published", "unpublished", "archived"]] = None

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        v = _blank_to_none(v)
        if v is None or len(v) > 120:
            raise ValueError("Name is required (max 120 characters).")
        return v

    @field_validator("description", "description_hi")
    @classmethod
    def _long(cls, v):
        return _text(1000)(v)

    @field_validator("phone", "whatsapp")
    @classmethod
    def _short(cls, v):
        return _text(40)(v)

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        return _text(254)(v)

    @field_validator("address")
    @classmethod
    def _addr(cls, v):
        return _text(300)(v)

    @field_validator("wifi_ssid")
    @classmethod
    def _ssid(cls, v):
        return _text(64)(v)

    @field_validator("wifi_password")
    @classmethod
    def _wifipw(cls, v):
        return _text(128)(v)

    @field_validator("maps_url", "website_url")
    @classmethod
    def _http(cls, v):
        return _url(("http:", "https:"), v)

    @field_validator("review_url")
    @classmethod
    def _https(cls, v):
        return _url(("https:",), v)

    @field_validator("profile_image", "logo")
    @classmethod
    def _img(cls, v):
        return _image(v)

    @field_validator("theme")
    @classmethod
    def _theme(cls, v):
        if v is not None and (len(v) > 30 or any(not isinstance(x, (str, int, float, bool)) for x in v.values())):
            raise ValueError("Invalid theme.")
        return v


class OrgCreate(OrgFields):
    slug: Optional[str] = None
    links: List["LinkInput"] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _name_required(self):
        if "name" not in self.model_fields_set:
            raise ValueError("Name is required.")
        return self


class OrgPatch(OrgFields):
    @model_validator(mode="after")
    def _any(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field")
        return self


class LinkFields(Strict):
    title: Optional[str] = None
    title_hi: Optional[str] = None
    destination_url: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    description_hi: Optional[str] = None
    is_featured: Optional[bool] = None
    status: Optional[Literal["active", "disabled"]] = None
    show_from: Optional[datetime] = None
    show_until: Optional[datetime] = None
    hours: Optional[Hours] = None

    @field_validator("title")
    @classmethod
    def _title(cls, v):
        v = _blank_to_none(v)
        if v is None or len(v) > 100:
            raise ValueError("Title is required (max 100 characters).")
        return v

    @field_validator("category")
    @classmethod
    def _cat(cls, v):
        v = _blank_to_none(v)
        if v is None or len(v) > 40:
            raise ValueError("Category is required (max 40 characters).")
        return v

    @field_validator("title_hi", "icon")
    @classmethod
    def _t100(cls, v):
        return _text(100)(v)

    @field_validator("description", "description_hi")
    @classmethod
    def _t300(cls, v):
        return _text(300)(v)

    @field_validator("destination_url")
    @classmethod
    def _dest(cls, v):
        v = _url(("http:", "https:", "tel:", "mailto:"), v)
        if v is None:
            raise ValueError("Destination URL is required.")
        return v

    @field_validator("show_from", "show_until", mode="before")
    @classmethod
    def _dates(cls, v):
        return _when(v)

    @model_validator(mode="after")
    def _ordered(self):
        if self.show_from and self.show_until and self.show_until <= self.show_from:
            raise ValueError("End must be after start.")
        return self


class LinkInput(LinkFields):
    title: str  # type: ignore[assignment]
    destination_url: str  # type: ignore[assignment]


class LinkPatch(LinkFields):
    @model_validator(mode="after")
    def _any(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field")
        return self


class PlacementFields(Strict):
    code: Optional[str] = None
    label: Optional[str] = None
    kind: Optional[Literal["room", "table", "lobby", "hall", "desk", "other"]] = None
    status: Optional[Literal["active", "disabled"]] = None

    @field_validator("code")
    @classmethod
    def _code(cls, v):
        return _code(v)

    @field_validator("label")
    @classmethod
    def _label(cls, v):
        v = _blank_to_none(v)
        if v is None or len(v) > 80:
            raise ValueError("Label is required (max 80 characters).")
        return v


def _code(v: Optional[str]) -> str:
    v = (v or "").strip()
    if not v or len(v) > 40 or not SLUG_RE.match(v):
        raise ValueError("Use lowercase letters, digits and single hyphens.")
    return v


class PlacementInput(PlacementFields):
    code: str  # type: ignore[assignment]
    label: str  # type: ignore[assignment]
    room_id: Optional[str] = None


class PlacementPatch(Strict):
    label: Optional[str] = None
    kind: Optional[Literal["room", "table", "lobby", "hall", "desk", "other"]] = None
    status: Optional[Literal["active", "disabled"]] = None
    room_id: Optional[str] = None

    @field_validator("label")
    @classmethod
    def _label(cls, v):
        v = _blank_to_none(v)
        if v is None or len(v) > 80:
            raise ValueError("Label is required (max 80 characters).")
        return v

    @model_validator(mode="after")
    def _any(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field")
        return self


class PlacementRange(Strict):
    kind: Literal["room", "table", "lobby", "hall", "desk", "other"]
    prefix: str
    labelPrefix: str
    from_: int = Field(alias="from", ge=0, le=99999)
    to: int = Field(ge=0, le=99999)
    random: bool = False
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    @field_validator("prefix")
    @classmethod
    def _prefix(cls, v):
        return _code(v)

    @field_validator("labelPrefix")
    @classmethod
    def _lp(cls, v):
        v = _blank_to_none(v)
        if v is None or len(v) > 60:
            raise ValueError("Label prefix is required (max 60 characters).")
        return v

    @model_validator(mode="after")
    def _span(self):
        if self.to < self.from_:
            raise ValueError('"to" must not be before "from".')
        if self.to - self.from_ + 1 > 500:
            raise ValueError("At most 500 placements at once.")
        return self


class OfferFields(Strict):
    text: Optional[str] = None
    text_hi: Optional[str] = None
    link_url: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None

    @field_validator("text")
    @classmethod
    def _text_f(cls, v):
        v = _blank_to_none(v)
        if v is None or len(v) > 300:
            raise ValueError("Text is required (max 300 characters).")
        return v

    @field_validator("text_hi")
    @classmethod
    def _hi(cls, v):
        return _text(300)(v)

    @field_validator("link_url")
    @classmethod
    def _lu(cls, v):
        return _url(("http:", "https:", "tel:", "mailto:"), v)

    @field_validator("starts_at", "ends_at", mode="before")
    @classmethod
    def _dates(cls, v):
        return _when(v)

    @model_validator(mode="after")
    def _ordered(self):
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("End must be after start.")
        return self


class OfferInput(OfferFields):
    text: str  # type: ignore[assignment]


class OfferPatch(OfferFields):
    @model_validator(mode="after")
    def _any(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field")
        return self


class BulkBody(Strict):
    entity: Literal["links", "placements", "organizations"]
    ids: List[str] = Field(min_length=1, max_length=500)
    action: Literal["enable", "disable", "delete"]

    @field_validator("ids")
    @classmethod
    def _ids(cls, v):
        return [_uid_value(x) for x in v]


OrgCreate.model_rebuild()


class LinkOrder(Strict):
    ids: List[str] = Field(max_length=500)

    @field_validator("ids")
    @classmethod
    def _ids(cls, v):
        return [_uid_value(x) for x in v]


class BulkLinks(Strict):
    links: List[LinkInput] = Field(min_length=1, max_length=500)


class BulkLinksToOrgs(Strict):
    slugs: List[str] = Field(min_length=1, max_length=200)
    links: List[LinkInput] = Field(min_length=1, max_length=500)


# ---- Serialisation ------------------------------------------------------------------------------------------------
def _s(v: Any) -> str:
    return v if v is not None else ""


def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d else None


def org_out(o: QrOrganization) -> Dict[str, Any]:
    return {
        "id": o.id, "slug": o.slug, "name": o.name, "category": o.category,
        "description": _s(o.description), "description_hi": _s(o.description_hi), "phone": _s(o.phone),
        "whatsapp": _s(o.whatsapp), "email": _s(o.email), "address": _s(o.address), "maps_url": _s(o.maps_url),
        "website_url": _s(o.website_url), "review_url": _s(o.review_url), "profile_image": _s(o.profile_image),
        "logo": _s(o.logo), "theme": o.theme or {}, "wifi_ssid": _s(o.wifi_ssid), "wifi_password": _s(o.wifi_password),
        "wifi_visible": bool(o.wifi_visible), "qr_status": o.qr_status, "status": o.status,
        "created_at": _iso(o.created_at), "updated_at": _iso(o.updated_at),
        # camelCase aliases kept for older consumers of the previous native implementation
        "qrStatus": o.qr_status, "mapsUrl": _s(o.maps_url), "websiteUrl": _s(o.website_url), "reviewUrl": _s(o.review_url),
    }


def link_out(l: QrLink) -> Dict[str, Any]:
    return {
        "id": l.id, "title": l.title, "title_hi": _s(l.title_hi), "destination_url": l.destination_url,
        "category": l.category, "icon": _s(l.icon), "description": _s(l.description),
        "description_hi": _s(l.description_hi), "sort_order": l.sort_order, "is_featured": bool(l.is_featured),
        "status": l.status, "show_from": _iso(l.show_from), "show_until": _iso(l.show_until), "hours": l.hours,
        "click_count": l.click_count or 0, "last_clicked_at": _iso(l.last_clicked_at),
    }


def placement_out(p: QrPlacement, visits: int = 0, clicks: int = 0) -> Dict[str, Any]:
    out = {"id": p.id, "code": p.code, "label": p.label, "kind": p.kind, "status": p.status, "visits": visits, "clicks": clicks}
    if p.room_id:
        out["room_id"] = p.room_id
    return out


def offer_out(f: QrOffer) -> Dict[str, Any]:
    return {
        "id": f.id, "text": f.text, "text_hi": _s(f.text_hi), "link_url": _s(f.link_url),
        "starts_at": _iso(f.starts_at) or "", "ends_at": _iso(f.ends_at) or "",
    }


# ---- Data helpers -------------------------------------------------------------------------------------------------
async def _org(db: AsyncSession, slug: str) -> QrOrganization:
    org = (await db.execute(select(QrOrganization).where(QrOrganization.slug == slug))).scalars().first()
    if not org:
        raise _err(404, "not_found")
    return org


async def _counts(db: AsyncSession, model, key) -> Dict[Any, int]:
    rows = (await db.execute(select(getattr(model, key), func.count()).group_by(getattr(model, key)))).all()
    return {k: n for k, n in rows if k is not None}


async def _next_sort(db: AsyncSession, org_id: str) -> int:
    m = (await db.execute(select(func.max(QrLink.sort_order)).where(QrLink.organization_id == org_id))).scalar()
    return 0 if m is None else m + 1


async def _workspace(db: AsyncSession, org: QrOrganization) -> Dict[str, Any]:
    links = (await db.execute(select(QrLink).where(QrLink.organization_id == org.id).order_by(QrLink.sort_order, QrLink.created_at))).scalars().all()
    places = (await db.execute(select(QrPlacement).where(QrPlacement.organization_id == org.id).order_by(QrPlacement.created_at, QrPlacement.code))).scalars().all()
    offers = (await db.execute(select(QrOffer).where(QrOffer.organization_id == org.id).order_by(QrOffer.created_at.desc()))).scalars().all()
    pv = await _counts(db, QrVisit, "placement_id")
    pc = await _counts(db, QrClick, "placement_id")
    return {
        "organization": org_out(org),
        "links": [link_out(l) for l in links],
        "placements": [placement_out(p, pv.get(p.id, 0), pc.get(p.id, 0)) for p in places],
        "offers": [offer_out(f) for f in offers],
    }


NON_NULL = {"qr_status", "status", "category", "kind", "is_featured", "wifi_visible", "title", "destination_url", "text", "code", "label", "name"}


def _apply(obj: Any, data: Dict[str, Any]) -> None:
    for k, v in data.items():
        if v is None and k in NON_NULL:
            continue
        if k == "theme" and v is None:
            v = {}
        if k == "hours" and v is not None:
            v = {"open": v["open"], "close": v["close"]} if isinstance(v, dict) else v.model_dump()
        setattr(obj, k, v)


def _dump(model: BaseModel) -> Dict[str, Any]:
    return model.model_dump(exclude_unset=True)


def _slugify(name: str) -> str:
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")[:60]


async def _delete_org_children(db: AsyncSession, org_ids: List[str]) -> None:
    for model in (QrClick, QrVisit, QrOffer, QrLink, QrPlacement):
        await db.execute(delete(model).where(model.organization_id.in_(org_ids)))


# ---- Organizations ------------------------------------------------------------------------------------------------
@router.get("/organizations", summary="List QR Hub Organizations")
async def list_orgs(
    search: Optional[str] = Query(None, max_length=100),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(QrOrganization).order_by(QrOrganization.name, QrOrganization.id)
    if category:
        q = q.where(QrOrganization.category == category)
    if status:
        q = q.where(QrOrganization.status == status)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        q = q.where(func.lower(QrOrganization.name).like(term) | func.lower(QrOrganization.slug).like(term))
    orgs = (await db.execute(q)).scalars().all()
    lc, pc = await _counts(db, QrLink, "organization_id"), await _counts(db, QrPlacement, "organization_id")
    vc, cc = await _counts(db, QrVisit, "organization_id"), await _counts(db, QrClick, "organization_id")
    items = []
    for o in orgs:
        d = org_out(o)
        d.pop("wifi_password")
        d.update(link_count=lc.get(o.id, 0), placement_count=pc.get(o.id, 0), visits=vc.get(o.id, 0),
                 visit_count=vc.get(o.id, 0), clicks=cc.get(o.id, 0), createdAt=d["created_at"])
        items.append(d)
    return {"items": items}


@router.post("/organizations", status_code=201, summary="Create QR Hub Organization")
async def create_org(body: OrgCreate, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    data = _dump(body)
    data.pop("links", None)
    links = body.links
    slug = data.pop("slug", None) or _slugify(body.name or "")
    if len(slug) < 2 or not SLUG_RE.match(slug):
        raise _err(422, "validation_failed", issues=[{"path": "slug", "message": "Provide a valid slug."}])
    if (await db.execute(select(QrOrganization.id).where(QrOrganization.slug == slug))).first():
        raise _err(409, "slug_taken")
    org = QrOrganization(slug=slug)
    _apply(org, data)
    db.add(org)
    await db.flush()
    for i, l in enumerate(links):
        link = QrLink(organization_id=org.id, sort_order=i)
        _apply(link, _dump(l))
        db.add(link)
    await db.commit()
    await db.refresh(org)
    return await _workspace(db, org)


@router.get("/organizations/{slug}", summary="Get Organization Detail")
async def get_org(slug: str, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await _workspace(db, await _org(db, slug))


@router.patch("/organizations/{slug}", summary="Update QR Hub Organization")
async def patch_org(slug: str, body: Dict[str, Any] = Body(...), auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org = await _org(db, slug)
    # Older clients send camelCase aliases; map them before validating.
    for alias, field in (("qrStatus", "qr_status"), ("mapsUrl", "maps_url"), ("websiteUrl", "website_url"), ("reviewUrl", "review_url")):
        if alias in body:
            body[field] = body.pop(alias)
    try:
        patch = OrgPatch.model_validate(body)
    except ValidationError as e:
        raise _err(422, "validation_failed", issues=[{"path": ".".join(str(x) for x in i["loc"]), "message": i["msg"]} for i in e.errors()])
    _apply(org, _dump(patch))
    await db.commit()
    await db.refresh(org)
    return {"ok": True, "organization": org_out(org)}


@router.delete("/organizations/{slug}", status_code=204, summary="Delete QR Hub Organization")
async def delete_org(slug: str, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org = await _org(db, slug)
    await _delete_org_children(db, [org.id])
    await db.delete(org)
    await db.commit()
    return Response(status_code=204)


@router.patch("/organizations/{slug}/status", summary="Update QR Hub Organization Status")
async def patch_org_status(slug: str, body: Dict[str, Any] = Body(...), auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org = await _org(db, slug)
    new = body.get("qr_status", body.get("qrStatus"))
    if new is not None:
        if new not in ("active", "inactive", "draft"):
            raise _err(422, "validation_failed", issues=[{"path": "qr_status", "message": "Invalid status."}])
        org.qr_status = new
    if "status" in body:
        if body["status"] not in ("published", "unpublished", "archived"):
            raise _err(422, "validation_failed", issues=[{"path": "status", "message": "Invalid status."}])
        org.status = body["status"]
    await db.commit()
    await db.refresh(org)
    return {"ok": True, "organization": org_out(org)}


# ---- Links --------------------------------------------------------------------------------------------------------
@router.post("/organizations/{slug}/links", status_code=201, summary="Add Link")
async def add_link(slug: str, body: LinkInput, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org = await _org(db, slug)
    link = QrLink(organization_id=org.id, sort_order=await _next_sort(db, org.id))
    _apply(link, _dump(body))
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return {"link": link_out(link)}


@router.patch("/links/{link_id}", summary="Update Link")
async def patch_link(link_id: str, body: LinkPatch, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    link_id = _uid(link_id)
    link = (await db.execute(select(QrLink).where(QrLink.id == link_id))).scalars().first()
    if not link:
        raise _err(404, "not_found")
    _apply(link, _dump(body))
    await db.commit()
    await db.refresh(link)
    return {"link": link_out(link)}


@router.delete("/links/{link_id}", status_code=204, summary="Delete Link")
async def delete_link(link_id: str, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    link_id = _uid(link_id)
    link = (await db.execute(select(QrLink).where(QrLink.id == link_id))).scalars().first()
    if not link:
        raise _err(404, "not_found")
    await db.execute(delete(QrClick).where(QrClick.link_id == link_id))
    await db.delete(link)
    await db.commit()
    return Response(status_code=204)


@router.put("/organizations/{slug}/links/order", summary="Reorder Links")
async def reorder_links(slug: str, body: LinkOrder, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org = await _org(db, slug)
    links = {l.id: l for l in (await db.execute(select(QrLink).where(QrLink.organization_id == org.id))).scalars().all()}
    if len(set(body.ids)) != len(body.ids) or any(i not in links for i in body.ids):
        raise _err(422, "validation_failed", issues=[{"path": "ids", "message": "Unknown or repeated link id."}])
    rest = [l for l in sorted(links.values(), key=lambda x: (x.sort_order, x.created_at)) if l.id not in body.ids]
    for pos, link_id in enumerate(body.ids + [l.id for l in rest]):
        links[link_id].sort_order = pos
    await db.commit()
    return {"links": [link_out(l) for l in sorted(links.values(), key=lambda x: x.sort_order)]}


@router.post("/organizations/{slug}/links/bulk", status_code=201, summary="Add Many Links")
async def bulk_links(slug: str, body: BulkLinks, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org = await _org(db, slug)
    sort = await _next_sort(db, org.id)
    out = []
    for i, l in enumerate(body.links):
        link = QrLink(organization_id=org.id, sort_order=sort + i)
        _apply(link, _dump(l))
        db.add(link)
        out.append(link)
    await db.commit()
    return {"links": [link_out(l) for l in out]}


@router.post("/links/bulk-to-organizations", status_code=201, summary="Add Links To Many Organizations")
async def bulk_links_to_orgs(body: BulkLinksToOrgs, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    orgs = (await db.execute(select(QrOrganization).where(QrOrganization.slug.in_(body.slugs)))).scalars().all()
    missing = [s for s in body.slugs if s not in {o.slug for o in orgs}]
    if missing:
        raise _err(404, "not_found", slugs=missing)
    for org in orgs:
        sort = await _next_sort(db, org.id)
        for i, l in enumerate(body.links):
            link = QrLink(organization_id=org.id, sort_order=sort + i)
            _apply(link, _dump(l))
            db.add(link)
        await db.flush()
    await db.commit()
    return {"organizations": len(orgs), "links": len(orgs) * len(body.links)}


# ---- Placements ---------------------------------------------------------------------------------------------------
@router.get("/organizations/{slug}/placements", summary="List Placements")
async def list_placements(slug: str, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return {"items": (await _workspace(db, await _org(db, slug)))["placements"]}


async def _code_taken(db: AsyncSession, org_id: str, codes: List[str]) -> List[str]:
    rows = (await db.execute(select(QrPlacement.code).where(QrPlacement.organization_id == org_id, QrPlacement.code.in_(codes)))).scalars().all()
    return list(rows)


@router.post("/organizations/{slug}/placements/rooms", summary="Create secure unguessable room placements for every room that has none")
async def sync_room_placements(slug: str, dry_run: bool = Query(False), auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Idempotent: rooms that already have a placement are skipped.
    Every new room placement gets an unguessable, cryptographically secure token
    mapping directly to that room's room_id."""
    org = await _org(db, slug)
    rooms = (await db.execute(select(Room).order_by(Room.room_number))).scalars().all()
    
    # Check which rooms already have an active placement for this org
    existing_placements = (await db.execute(
        select(QrPlacement).where(
            QrPlacement.organization_id == org.id,
            QrPlacement.kind == "room",
        )
    )).scalars().all()
    
    existing_room_ids = {p.room_id for p in existing_placements if p.room_id}
    existing_labels = {p.label for p in existing_placements}
    
    created = []
    for r in rooms:
        lbl = f"Room {r.room_number}"
        if r.room_id in existing_room_ids or lbl in existing_labels:
            continue
        # Generate cryptographically secure token (128 bits entropy)
        token = f"rm-{secrets.token_hex(16)}"
        p = QrPlacement(
            organization_id=org.id,
            code=token,
            label=lbl,
            kind="room",
            status="active",
            room_id=r.room_id,
        )
        created.append(p)
    
    existing_count = len(rooms) - len(created)
    if dry_run:  # preview only: lets the screen show which rooms would get a QR before anything is written
        return {"created": [], "wouldCreate": [p.label for p in created], "existing": existing_count}
    db.add_all(created)
    await db.commit()
    invalidate_hub_cache(slug)
    return {"created": [placement_out(p) for p in created], "existing": existing_count}


@router.post("/organizations/{slug}/placements", status_code=201, summary="Add Placement")
async def add_placement(slug: str, body: PlacementInput, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org = await _org(db, slug)
    if await _code_taken(db, org.id, [body.code]):
        raise _err(409, "code_taken")
    p = QrPlacement(organization_id=org.id, code=body.code, label=body.label, kind=body.kind or "other", status=body.status or "active", room_id=body.room_id)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    out = placement_out(p)
    return {"placement": out, **out}


@router.post("/organizations/{slug}/placements/bulk", status_code=201, summary="Add Placement Range")
async def bulk_placements(slug: str, body: PlacementRange, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org = await _org(db, slug)
    items = []
    for n in range(body.from_, body.to + 1):
        code = (
            f"{body.prefix[:26].rstrip('-')}-{n}-{''.join(secrets.choice(CODE_ALPHABET) for _ in range(7))}"
            if body.random else f"{body.prefix}-{n}"
        )
        items.append((code, f"{body.labelPrefix} {n}"))
    taken = await _code_taken(db, org.id, [c for c, _ in items])
    if taken:
        raise _err(409, "code_taken", conflicts=taken)
    created = [QrPlacement(organization_id=org.id, code=c, label=lbl, kind=body.kind, status="active") for c, lbl in items]
    db.add_all(created)
    await db.commit()
    return {"items": [placement_out(p) for p in created]}


@router.patch("/placements/{placement_id}", summary="Update Placement")
async def patch_placement(placement_id: str, body: PlacementPatch, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    placement_id = _uid(placement_id)
    p = (await db.execute(select(QrPlacement).where(QrPlacement.id == placement_id))).scalars().first()
    if not p:
        raise _err(404, "not_found")
    _apply(p, _dump(body))
    await db.commit()
    await db.refresh(p)
    out = placement_out(p)
    return {"placement": out, **out}


@router.post("/organizations/{slug}/placements/{placement_id}/rotate", summary="Rotate QR Token for a placement")
async def rotate_placement_token(
    slug: str,
    placement_id: str,
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    org = await _org(db, slug)
    placement_id = _uid(placement_id)
    p = (await db.execute(
        select(QrPlacement).where(QrPlacement.id == placement_id, QrPlacement.organization_id == org.id)
    )).scalars().first()
    if not p:
        raise _err(404, "not_found")
    
    # Generate new cryptographically secure token
    if p.kind == "room":
        new_token = f"rm-{secrets.token_hex(16)}"
    else:
        new_token = f"{p.code[:10]}-{secrets.token_hex(8)}"
    
    p.code = new_token
    
    # If room placement, rotate Room.qr_token as well so old ordering sessions are terminated
    if p.kind == "room" and p.room_id:
        room = await db.get(Room, p.room_id)
        if room:
            room.qr_token = str(uuid.uuid4())
            
    await db.commit()
    await db.refresh(p)
    invalidate_hub_cache(slug)
    return {"status": "rotated", "placement": placement_out(p)}


@router.post("/organizations/{slug}/placements/{placement_id}/revoke", summary="Revoke a QR placement")
async def revoke_placement_token(
    slug: str,
    placement_id: str,
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    org = await _org(db, slug)
    placement_id = _uid(placement_id)
    p = (await db.execute(
        select(QrPlacement).where(QrPlacement.id == placement_id, QrPlacement.organization_id == org.id)
    )).scalars().first()
    if not p:
        raise _err(404, "not_found")
    
    p.status = "disabled"
    await db.commit()
    await db.refresh(p)
    invalidate_hub_cache(slug)
    return {"status": "revoked", "placement": placement_out(p)}


@router.delete("/placements/{placement_id}", status_code=204, summary="Delete Placement")
async def delete_placement(placement_id: str, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    placement_id = _uid(placement_id)
    p = (await db.execute(select(QrPlacement).where(QrPlacement.id == placement_id))).scalars().first()
    if not p:
        raise _err(404, "not_found")
    await _detach_placements(db, [placement_id])
    await db.delete(p)
    await db.commit()
    return Response(status_code=204)


async def _detach_placements(db: AsyncSession, ids: List[str]) -> None:
    """History stays; it just no longer points at a deleted placement."""
    await db.execute(update(QrVisit).where(QrVisit.placement_id.in_(ids)).values(placement_id=None))
    await db.execute(update(QrClick).where(QrClick.placement_id.in_(ids)).values(placement_id=None))


# ---- Offers -------------------------------------------------------------------------------------------------------
@router.get("/organizations/{slug}/offers", summary="List Offers")
async def list_offers(slug: str, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return {"items": (await _workspace(db, await _org(db, slug)))["offers"]}


@router.post("/organizations/{slug}/offers", status_code=201, summary="Add Offer")
async def add_offer(slug: str, body: OfferInput, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org = await _org(db, slug)
    offer = QrOffer(organization_id=org.id)
    _apply(offer, _dump(body))
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return {"offer": offer_out(offer)}


@router.patch("/offers/{offer_id}", summary="Update Offer")
async def patch_offer(offer_id: str, body: OfferPatch, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    offer_id = _uid(offer_id)
    offer = (await db.execute(select(QrOffer).where(QrOffer.id == offer_id))).scalars().first()
    if not offer:
        raise _err(404, "not_found")
    _apply(offer, _dump(body))
    await db.commit()
    await db.refresh(offer)
    return {"offer": offer_out(offer)}


@router.delete("/offers/{offer_id}", status_code=204, summary="Delete Offer")
async def delete_offer(offer_id: str, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    offer_id = _uid(offer_id)
    offer = (await db.execute(select(QrOffer).where(QrOffer.id == offer_id))).scalars().first()
    if not offer:
        raise _err(404, "not_found")
    await db.delete(offer)
    await db.commit()
    return Response(status_code=204)


# ---- Bulk actions -------------------------------------------------------------------------------------------------
@router.post("/bulk", summary="Bulk Action on QR Hub Entities")
async def bulk_action(body: BulkBody, auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    model = {"links": QrLink, "placements": QrPlacement, "organizations": QrOrganization}[body.entity]
    found = (await db.execute(select(model.id).where(model.id.in_(body.ids)))).scalars().all()
    if not found:
        return {"affected": 0}
    if body.action == "delete":
        if body.entity == "organizations":
            await _delete_org_children(db, found)
        elif body.entity == "links":
            await db.execute(delete(QrClick).where(QrClick.link_id.in_(found)))
        else:
            await _detach_placements(db, found)
        await db.execute(delete(model).where(model.id.in_(found)))
    else:
        on = body.action == "enable"
        values = {"qr_status": "active" if on else "inactive"} if body.entity == "organizations" else {"status": "active" if on else "disabled"}
        await db.execute(update(model).where(model.id.in_(found)).values(**values))
    await db.commit()
    return {"affected": len(found)}


# ---- Export, integrations, import ---------------------------------------------------------------------------------
@router.get("/export.json", summary="Export QR Hub as JSON")
async def export_json(
    slugs: str = Query("all", max_length=5000),
    includeWifi: Literal["0", "1"] = Query("0"),
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    import json

    q = select(QrOrganization).order_by(QrOrganization.name)
    if slugs != "all":
        wanted = [s.strip() for s in slugs.split(",") if s.strip()]
        if len(wanted) > 200 or not all(SLUG_RE.match(s) for s in wanted):
            raise _err(422, "validation_failed", issues=[{"path": "slugs", "message": 'Use "all" or up to 200 comma-separated slugs.'}])
        q = q.where(QrOrganization.slug.in_(wanted))
    base = get_public_site_url()
    orgs = []
    for o in (await db.execute(q)).scalars().all():
        ws = await _workspace(db, o)
        orgs.append({
            "slug": o.slug, "name": o.name, "category": o.category, "description": o.description,
            "description_hi": o.description_hi, "phone": o.phone, "whatsapp": o.whatsapp, "email": o.email,
            "address": o.address, "maps_url": o.maps_url, "website_url": o.website_url, "review_url": o.review_url,
            "profile_image": o.profile_image, "logo": o.logo, "theme": o.theme or {},
            "wifi": {"ssid": o.wifi_ssid, "visible": bool(o.wifi_visible), **({"password": o.wifi_password} if includeWifi == "1" else {})},
            "qr_status": o.qr_status, "status": o.status,
            "links": [{k: l[k] for k in ("title", "title_hi", "destination_url", "category", "icon", "description", "description_hi", "is_featured", "status", "show_from", "show_until", "hours")} for l in ws["links"]],
            "placements": [{k: p[k] for k in ("code", "label", "kind", "status")} for p in ws["placements"]],
            "offers": [{k: f[k] for k in ("text", "text_hi", "link_url", "starts_at", "ends_at")} for f in ws["offers"]],
            "qr_urls": [{"placement": None, "label": o.name, "url": f"{base}/r/{o.slug}"}]
            + [{"placement": p["code"], "label": p["label"], "url": f"{base}/r/{o.slug}?p={p['code']}"} for p in ws["placements"]],
        })
    doc = {"format": "dream-heavens-qr-hub", "version": 1, "exported_at": datetime.now(timezone.utc).isoformat(), "organizations": orgs}
    return Response(
        content=json.dumps(doc, indent=2, ensure_ascii=False),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="qr-hub-export.json"'},
    )


@router.get("/organizations/{slug}/integrations", summary="Analytics Integrations (GA4 / Search Console)")
async def integrations(slug: str, days: int = Query(30, ge=1, le=90), auth: Dict[str, Any] = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    await _org(db, slug)
    return {"connected": False, "ga4": {"status": "not_connected"}, "gsc": {"status": "not_connected"}}


@router.post("/import.json", summary="Import QR Hub JSON")
async def import_json():
    raise _err(501, "import_not_available")
