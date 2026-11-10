import React from 'react';
import { Field, GoTo, NumberInput, SettingsSection, SubHeading, ToggleGrid, ToggleRow, useSettingsSection } from '../components/ui';

const C = 'housekeeping';

const LIFECYCLE = [
  { name: 'Vacant dirty', note: 'After check-out', cls: 'border-rose-200 bg-rose-50 text-rose-800' },
  { name: 'Cleaning', note: 'Housekeeper in room', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  { name: 'Cleaned', note: 'Waiting for inspection', cls: 'border-sky-200 bg-sky-50 text-sky-800' },
  { name: 'Inspected', note: 'Ready to sell', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
];

export const HousekeepingTab: React.FC = () => {
  const [status, setStatus] = useSettingsSection('roomStatusPolicy');
  const [outage, setOutage] = useSettingsSection('roomOutage');
  const [hk, setHk] = useSettingsSection('housekeepingAutomation');
  const [mt, setMt] = useSettingsSection('maintenanceAutomation');

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="room-status" title="Room status & inspection" description="When a room may be assigned and sold after cleaning.">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Room cleaning stages">
          {LIFECYCLE.map((s, i) => (
            <li key={s.name} className={`rounded-lg border p-2.5 text-center ${s.cls}`}>
              <span className="block text-xs font-semibold">
                {i + 1}. {s.name}
              </span>
              <span className="text-[11px] opacity-80">{s.note}</span>
            </li>
          ))}
        </ol>
        <ToggleGrid cols={3}>
          <ToggleRow label="Inspection required before sale" description="Only inspected rooms can be checked in." checked={status.inspectionRequiredBeforeSell} onChange={(v) => setStatus({ inspectionRequiredBeforeSell: v })} />
          <ToggleRow label="Assign before inspection" description="Front desk may pre-assign a room that is still being cleaned." checked={status.allowFrontDeskAssignmentBeforeInspection} onChange={(v) => setStatus({ allowFrontDeskAssignmentBeforeInspection: v })} />
          <ToggleRow label="Supervisor override" description="A duty manager can skip inspection during rush hours." checked={status.supervisorOverrideAllowed} onChange={(v) => setStatus({ supervisorOverrideAllowed: v })} />
        </ToggleGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="outage" title="Out of service & out of order" description="Out of service is a minor issue; the room still counts as inventory. Out of order removes it from sale.">
        <ToggleGrid>
          <div className="space-y-3 rounded-lg border border-amber-200 p-3">
            <p className="text-sm font-semibold text-amber-900">Out of service (minor issue)</p>
            <ToggleRow label="Can be sold when the hotel is full" checked={outage.oosSellable} onChange={(v) => setOutage({ oosSellable: v })} />
            <ToggleRow label="Reason required" checked={outage.requireReasonForOOS} onChange={(v) => setOutage({ requireReasonForOOS: v })} />
          </div>
          <div className="space-y-3 rounded-lg border border-rose-200 p-3">
            <p className="text-sm font-semibold text-rose-800">Out of order (major defect)</p>
            <ToggleRow label="Can be sold" description="Never. Out-of-order rooms are always off sale." checked={false} onChange={() => {}} disabled />
            <ToggleRow label="Reason and incident note required" checked={outage.requireReasonForOOO} onChange={(v) => setOutage({ requireReasonForOOO: v })} />
          </div>
        </ToggleGrid>
        <p className="text-xs text-muted-foreground">
          Manager approval to mark a room out of order is set in <GoTo tab="security" section="approvals">Manager approvals</GoTo>.
        </p>
      </SettingsSection>

      <SettingsSection categoryId={C} id="tasks" title="Housekeeping tasks" description="Tasks created automatically and what staff must do to close them.">
        <SubHeading>Create tasks automatically</SubHeading>
        <ToggleGrid cols={3}>
          <ToggleRow label="On check-out" description="Full clean of the departed room." checked={hk.autoCreateDepartureTask} onChange={(v) => setHk({ autoCreateDepartureTask: v })} />
          <ToggleRow label="Daily for stayovers" description="Morning refresh of occupied rooms." checked={hk.autoCreateStayoverTask} onChange={(v) => setHk({ autoCreateStayoverTask: v })} />
          <ToggleRow label="Inspection after cleaning" description="Sent to the supervisor when a room is marked cleaned." checked={hk.autoCreateInspectionTask} onChange={(v) => setHk({ autoCreateInspectionTask: v })} />
        </ToggleGrid>
        <SubHeading>Completion</SubHeading>
        <ToggleGrid>
          <ToggleRow label="Photo required on completion" checked={hk.requirePhotoOnCompletion} onChange={(v) => setHk({ requirePhotoOnCompletion: v })} />
          <div className="rounded-lg border border-border bg-cream/40 p-3">
            <Field label="Change stayover linen every" hint="Fewer changes save water and energy.">
              {(p) => <NumberInput {...p} min={1} max={7} unit="days" value={hk.stayoverLinenChangeFrequencyDays} onChange={(v) => setHk({ stayoverLinenChangeFrequencyDays: v })} />}
            </Field>
          </div>
        </ToggleGrid>
      </SettingsSection>

      <SettingsSection categoryId={C} id="maintenance" title="Maintenance" description="Rules for maintenance tickets that affect rooms.">
        <ToggleGrid>
          <ToggleRow label="Take room out of service on a critical ticket" checked={mt.autoMarkRoomOOSOnCriticalTicket} onChange={(v) => setMt({ autoMarkRoomOOSOnCriticalTicket: v })} />
          <ToggleRow label="Resolution note required to close a ticket" checked={mt.requireResolutionNote} onChange={(v) => setMt({ requireResolutionNote: v })} />
          <ToggleRow label="Photo of the repair required" checked={mt.requireCompletionPhoto} onChange={(v) => setMt({ requireCompletionPhoto: v })} />
          <ToggleRow label="Manager approval before the room goes back on sale" checked={mt.managerApprovalBeforeReturningRoom} onChange={(v) => setMt({ managerApprovalBeforeReturningRoom: v })} />
        </ToggleGrid>
      </SettingsSection>
    </div>
  );
};
