"""
Test suite for the Scheduling System APIs.
Tests: Professionals CRUD, Working Hours, Appointments, Public Booking
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://virtual-barber-8.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

# Test credentials
BARBERSHOP_OWNER = {"email": "dono@barbeariaprime.com", "password": "dono123"}
MASTER_ADMIN = {"email": "admin@hairbarber.master", "password": "master123"}
BARBERSHOP_ID = "074ae744-d206-4552-bd42-7ca417b6e430"


class TestSchedulingAPIs:
    """Test scheduling system APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as barbershop owner
        response = self.session.post(f"{API}/auth/login", json=BARBERSHOP_OWNER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.user = response.json()
        yield
        # Cleanup
        self.session.close()
    
    # ===== PROFESSIONALS CRUD =====
    
    def test_list_professionals(self):
        """GET /api/barbershop/professionals - List professionals"""
        response = self.session.get(f"{API}/barbershop/professionals")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ List professionals: {len(data)} professionals found")
        # Store for later tests
        self.professionals = data
        return data
    
    def test_create_professional(self):
        """POST /api/barbershop/professionals - Create professional"""
        payload = {
            "name": "TEST_Barbeiro Teste",
            "phone": "(11) 99999-0001",
            "email": "test_barbeiro@test.com",
            "specialties": ["haircut", "beard"]
        }
        response = self.session.post(f"{API}/barbershop/professionals", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["name"] == payload["name"], "Name mismatch"
        assert data["phone"] == payload["phone"], "Phone mismatch"
        assert "id" in data, "ID not returned"
        print(f"✅ Create professional: {data['name']} (ID: {data['id']})")
        return data
    
    def test_update_professional(self):
        """PUT /api/barbershop/professionals/{id} - Update professional"""
        # First create a professional
        create_payload = {
            "name": "TEST_Update Barbeiro",
            "phone": "(11) 99999-0002",
            "specialties": ["haircut"]
        }
        create_response = self.session.post(f"{API}/barbershop/professionals", json=create_payload)
        assert create_response.status_code == 200
        pro_id = create_response.json()["id"]
        
        # Update
        update_payload = {"name": "TEST_Updated Barbeiro", "specialties": ["haircut", "beard", "combo"]}
        response = self.session.put(f"{API}/barbershop/professionals/{pro_id}", json=update_payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["name"] == update_payload["name"], "Name not updated"
        assert "combo" in data["specialties"], "Specialties not updated"
        print(f"✅ Update professional: {data['name']}")
        
        # Cleanup
        self.session.delete(f"{API}/barbershop/professionals/{pro_id}")
        return data
    
    def test_delete_professional(self):
        """DELETE /api/barbershop/professionals/{id} - Delete professional"""
        # First create
        create_payload = {"name": "TEST_Delete Barbeiro", "phone": "(11) 99999-0003", "specialties": ["haircut"]}
        create_response = self.session.post(f"{API}/barbershop/professionals", json=create_payload)
        assert create_response.status_code == 200
        pro_id = create_response.json()["id"]
        
        # Delete
        response = self.session.delete(f"{API}/barbershop/professionals/{pro_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify deleted
        get_response = self.session.get(f"{API}/barbershop/professionals")
        pros = get_response.json()
        assert not any(p["id"] == pro_id for p in pros), "Professional not deleted"
        print(f"✅ Delete professional: {pro_id}")
    
    # ===== WORKING HOURS =====
    
    def test_get_working_hours(self):
        """GET /api/barbershop/working-hours - Get working hours"""
        response = self.session.get(f"{API}/barbershop/working-hours")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "monday" in data, "Monday not in response"
        assert "barbershop_id" in data, "barbershop_id not in response"
        print(f"✅ Get working hours: barbershop_id={data['barbershop_id']}")
        return data
    
    def test_update_working_hours(self):
        """PUT /api/barbershop/working-hours - Update working hours"""
        payload = {
            "monday": {"open": "09:00", "close": "19:00", "enabled": True},
            "saturday": {"open": "09:00", "close": "15:00", "enabled": True},
            "sunday": {"open": "10:00", "close": "14:00", "enabled": False}
        }
        response = self.session.put(f"{API}/barbershop/working-hours", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["monday"]["open"] == "09:00", "Monday open not updated"
        assert data["monday"]["close"] == "19:00", "Monday close not updated"
        print(f"✅ Update working hours: Monday {data['monday']['open']}-{data['monday']['close']}")
        
        # Restore defaults
        restore_payload = {
            "monday": {"open": "08:00", "close": "18:00", "enabled": True},
            "saturday": {"open": "08:00", "close": "14:00", "enabled": True},
            "sunday": {"open": "08:00", "close": "18:00", "enabled": False}
        }
        self.session.put(f"{API}/barbershop/working-hours", json=restore_payload)
        return data
    
    # ===== APPOINTMENTS =====
    
    def test_list_appointments(self):
        """GET /api/barbershop/appointments - List appointments"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = self.session.get(f"{API}/barbershop/appointments", params={"date": today})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ List appointments for {today}: {len(data)} appointments")
        return data
    
    def test_create_appointment(self):
        """POST /api/barbershop/appointments - Create appointment"""
        # Get a professional and service first
        pros_response = self.session.get(f"{API}/barbershop/professionals")
        pros = pros_response.json()
        assert len(pros) > 0, "No professionals available"
        
        services_response = self.session.get(f"{API}/barbershop/services")
        services = services_response.json()
        assert len(services) > 0, "No services available"
        
        # Use tomorrow to avoid conflicts
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        payload = {
            "professional_id": pros[0]["id"],
            "service_id": services[0]["id"],
            "client_name": "TEST_Cliente Agendamento",
            "client_phone": "(11) 99999-8888",
            "date": tomorrow,
            "start_time": "10:00",
            "notes": "Test appointment"
        }
        response = self.session.post(f"{API}/barbershop/appointments", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["client_name"] == payload["client_name"], "Client name mismatch"
        assert data["date"] == tomorrow, "Date mismatch"
        assert data["status"] == "scheduled", "Status should be scheduled"
        assert "end_time" in data, "end_time not calculated"
        print(f"✅ Create appointment: {data['client_name']} at {data['start_time']}-{data['end_time']}")
        return data
    
    def test_update_appointment_status(self):
        """PUT /api/barbershop/appointments/{id}/status - Update status"""
        # Create an appointment first
        pros = self.session.get(f"{API}/barbershop/professionals").json()
        services = self.session.get(f"{API}/barbershop/services").json()
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        create_payload = {
            "professional_id": pros[0]["id"],
            "service_id": services[0]["id"],
            "client_name": "TEST_Status Update",
            "client_phone": "(11) 99999-7777",
            "date": tomorrow,
            "start_time": "11:00"
        }
        create_response = self.session.post(f"{API}/barbershop/appointments", json=create_payload)
        assert create_response.status_code == 200
        apt_id = create_response.json()["id"]
        
        # Update status to completed
        response = self.session.put(f"{API}/barbershop/appointments/{apt_id}/status", json={"status": "completed"})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["status"] == "completed", "Status not updated"
        print(f"✅ Update appointment status: {apt_id} -> completed")
        
        # Cleanup
        self.session.delete(f"{API}/barbershop/appointments/{apt_id}")
        return data
    
    def test_appointment_conflict_detection(self):
        """Test conflict detection - same professional, same time"""
        pros = self.session.get(f"{API}/barbershop/professionals").json()
        services = self.session.get(f"{API}/barbershop/services").json()
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        
        # Create first appointment
        payload1 = {
            "professional_id": pros[0]["id"],
            "service_id": services[0]["id"],
            "client_name": "TEST_Conflict 1",
            "client_phone": "(11) 99999-6666",
            "date": tomorrow,
            "start_time": "14:00"
        }
        response1 = self.session.post(f"{API}/barbershop/appointments", json=payload1)
        assert response1.status_code == 200, f"First appointment failed: {response1.text}"
        apt1_id = response1.json()["id"]
        
        # Try to create conflicting appointment
        payload2 = {
            "professional_id": pros[0]["id"],
            "service_id": services[0]["id"],
            "client_name": "TEST_Conflict 2",
            "client_phone": "(11) 99999-5555",
            "date": tomorrow,
            "start_time": "14:00"  # Same time!
        }
        response2 = self.session.post(f"{API}/barbershop/appointments", json=payload2)
        assert response2.status_code == 409, f"Expected 409 conflict, got {response2.status_code}: {response2.text}"
        print(f"✅ Conflict detection working: 409 returned for overlapping appointment")
        
        # Cleanup
        self.session.delete(f"{API}/barbershop/appointments/{apt1_id}")
    
    def test_delete_appointment(self):
        """DELETE /api/barbershop/appointments/{id} - Delete appointment"""
        pros = self.session.get(f"{API}/barbershop/professionals").json()
        services = self.session.get(f"{API}/barbershop/services").json()
        tomorrow = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        # Create
        create_payload = {
            "professional_id": pros[0]["id"],
            "service_id": services[0]["id"],
            "client_name": "TEST_Delete Appointment",
            "client_phone": "(11) 99999-4444",
            "date": tomorrow,
            "start_time": "15:00"
        }
        create_response = self.session.post(f"{API}/barbershop/appointments", json=create_payload)
        assert create_response.status_code == 200
        apt_id = create_response.json()["id"]
        
        # Delete
        response = self.session.delete(f"{API}/barbershop/appointments/{apt_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✅ Delete appointment: {apt_id}")


class TestPublicBookingAPIs:
    """Test public booking APIs (no auth required)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session without auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
        self.session.close()
    
    def test_get_public_barbershop_info(self):
        """GET /api/public/barbershop/{id} - Get public info"""
        response = self.session.get(f"{API}/public/barbershop/{BARBERSHOP_ID}")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "name" in data, "Name not in response"
        assert "services" in data, "Services not in response"
        assert "professionals" in data, "Professionals not in response"
        assert "working_hours" in data, "Working hours not in response"
        assert data["name"] == "Barbearia Prime", f"Expected 'Barbearia Prime', got '{data['name']}'"
        print(f"✅ Public barbershop info: {data['name']} - {len(data['services'])} services, {len(data['professionals'])} professionals")
        return data
    
    def test_get_available_slots(self):
        """GET /api/public/barbershop/{id}/available-slots - Get available slots"""
        # First get barbershop info to get professional and service IDs
        info_response = self.session.get(f"{API}/public/barbershop/{BARBERSHOP_ID}")
        info = info_response.json()
        
        if len(info["professionals"]) == 0 or len(info["services"]) == 0:
            pytest.skip("No professionals or services available")
        
        pro_id = info["professionals"][0]["id"]
        service_id = info["services"][0]["id"]
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{API}/public/barbershop/{BARBERSHOP_ID}/available-slots",
            params={"date": tomorrow, "professional_id": pro_id, "service_id": service_id}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "slots" in data, "Slots not in response"
        assert isinstance(data["slots"], list), "Slots should be a list"
        print(f"✅ Available slots for {tomorrow}: {len(data['slots'])} slots")
        return data
    
    def test_public_booking(self):
        """POST /api/public/barbershop/{id}/book - Public booking"""
        # Get barbershop info
        info_response = self.session.get(f"{API}/public/barbershop/{BARBERSHOP_ID}")
        info = info_response.json()
        
        if len(info["professionals"]) == 0 or len(info["services"]) == 0:
            pytest.skip("No professionals or services available")
        
        pro_id = info["professionals"][0]["id"]
        service_id = info["services"][0]["id"]
        
        # Get available slots
        future_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        slots_response = self.session.get(
            f"{API}/public/barbershop/{BARBERSHOP_ID}/available-slots",
            params={"date": future_date, "professional_id": pro_id, "service_id": service_id}
        )
        slots = slots_response.json()["slots"]
        
        if len(slots) == 0:
            pytest.skip("No available slots")
        
        # Book
        payload = {
            "professional_id": pro_id,
            "service_id": service_id,
            "client_name": "TEST_Public Booking Client",
            "client_phone": "(11) 99999-3333",
            "date": future_date,
            "start_time": slots[0]["start"]
        }
        response = self.session.post(f"{API}/public/barbershop/{BARBERSHOP_ID}/book", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["client_name"] == payload["client_name"], "Client name mismatch"
        assert data["status"] == "scheduled", "Status should be scheduled"
        print(f"✅ Public booking: {data['client_name']} at {data['date']} {data['start_time']}")
        
        # Cleanup - need auth to delete
        auth_session = requests.Session()
        auth_session.post(f"{API}/auth/login", json=BARBERSHOP_OWNER)
        auth_session.delete(f"{API}/barbershop/appointments/{data['id']}")
        auth_session.close()
        
        return data
    
    def test_public_booking_conflict(self):
        """Test public booking conflict detection"""
        info_response = self.session.get(f"{API}/public/barbershop/{BARBERSHOP_ID}")
        info = info_response.json()
        
        if len(info["professionals"]) == 0 or len(info["services"]) == 0:
            pytest.skip("No professionals or services available")
        
        pro_id = info["professionals"][0]["id"]
        service_id = info["services"][0]["id"]
        future_date = (datetime.now() + timedelta(days=6)).strftime("%Y-%m-%d")
        
        # Get slots
        slots_response = self.session.get(
            f"{API}/public/barbershop/{BARBERSHOP_ID}/available-slots",
            params={"date": future_date, "professional_id": pro_id, "service_id": service_id}
        )
        slots = slots_response.json()["slots"]
        
        if len(slots) == 0:
            pytest.skip("No available slots")
        
        # First booking
        payload1 = {
            "professional_id": pro_id,
            "service_id": service_id,
            "client_name": "TEST_Public Conflict 1",
            "client_phone": "(11) 99999-2222",
            "date": future_date,
            "start_time": slots[0]["start"]
        }
        response1 = self.session.post(f"{API}/public/barbershop/{BARBERSHOP_ID}/book", json=payload1)
        assert response1.status_code == 200
        apt1_id = response1.json()["id"]
        
        # Second booking - same time
        payload2 = {
            "professional_id": pro_id,
            "service_id": service_id,
            "client_name": "TEST_Public Conflict 2",
            "client_phone": "(11) 99999-1111",
            "date": future_date,
            "start_time": slots[0]["start"]
        }
        response2 = self.session.post(f"{API}/public/barbershop/{BARBERSHOP_ID}/book", json=payload2)
        assert response2.status_code == 409, f"Expected 409 conflict, got {response2.status_code}"
        print(f"✅ Public booking conflict detection working")
        
        # Cleanup
        auth_session = requests.Session()
        auth_session.post(f"{API}/auth/login", json=BARBERSHOP_OWNER)
        auth_session.delete(f"{API}/barbershop/appointments/{apt1_id}")
        auth_session.close()


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_professionals(self):
        """Remove TEST_ prefixed professionals"""
        session = requests.Session()
        session.post(f"{API}/auth/login", json=BARBERSHOP_OWNER)
        
        pros = session.get(f"{API}/barbershop/professionals").json()
        deleted = 0
        for pro in pros:
            if pro["name"].startswith("TEST_"):
                session.delete(f"{API}/barbershop/professionals/{pro['id']}")
                deleted += 1
        
        print(f"✅ Cleanup: Deleted {deleted} test professionals")
        session.close()
    
    def test_cleanup_test_appointments(self):
        """Remove TEST_ prefixed appointments"""
        session = requests.Session()
        session.post(f"{API}/auth/login", json=BARBERSHOP_OWNER)
        
        # Check multiple dates
        deleted = 0
        for days in range(0, 10):
            date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
            apts = session.get(f"{API}/barbershop/appointments", params={"date": date}).json()
            for apt in apts:
                if apt["client_name"].startswith("TEST_"):
                    session.delete(f"{API}/barbershop/appointments/{apt['id']}")
                    deleted += 1
        
        print(f"✅ Cleanup: Deleted {deleted} test appointments")
        session.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
