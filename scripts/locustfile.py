"""Locust load test suite for Hotel Dream Heaven's API.

Run locally:
  locust -f scripts/locustfile.py --host http://127.0.0.1:8001
Run headless:
  locust -f scripts/locustfile.py --headless -u 25 -r 5 --run-time 1m --host http://127.0.0.1:8001
"""
import random
from locust import HttpUser, task, between


class GuestAndStaffUser(HttpUser):
    wait_time = between(0.5, 2.0)

    @task(6)
    def browse_room_categories(self):
        """Simulates public guests searching for rooms."""
        self.client.get("/api/v1/availability/categories", name="01_Browse_Categories")

    @task(3)
    def browse_dining_menu(self):
        """Simulates guests viewing the F&B in-room dining menu."""
        self.client.get("/api/v1/pos/menu", name="02_Browse_POS_Menu")

    @task(1)
    def health_readiness(self):
        """Simulates uptime and Kubernetes/Coolify readiness checks."""
        self.client.get("/health/ready", name="03_Readiness_DB_Ping")
