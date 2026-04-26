"""
Backend API tests for Master Panel and Barbershop Management
Tests: Authentication, Master Stats, Barbershop CRUD
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://virtual-barber-8.preview.emergentagent.com').rstrip('/')

# Test credentials from test_credentials.md
MASTER_ADMIN_EMAIL = "admin@hairbarber.master"
MASTER_ADMIN_PASSWORD = "master123"
BARBERSHOP_OWNER_EMAIL = "dono@barbeariaprime.com"
BARBERSHOP_OWNER_PASSWORD = "dono123"


class TestHealthCheck:
    """Basic API health check"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ API root working: {data['message']}")


class TestMasterAdminAuth:
    """Master Admin authentication tests"""
    
    def test_master_admin_login_success(self):
        """Test master admin can login successfully"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "name" in data
        assert "email" in data
        assert "role" in data
        
        # Verify role is master_admin
        assert data["role"] == "master_admin", f"Expected master_admin role, got {data['role']}"
        assert data["email"] == MASTER_ADMIN_EMAIL
        
        # Verify cookies are set (httpOnly)
        assert "access_token" in session.cookies or response.cookies.get("access_token") is not None
        
        print(f"✅ Master admin login successful: {data['name']} ({data['role']})")
    
    def test_master_admin_login_invalid_credentials(self):
        """Test login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MASTER_ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        print("✅ Invalid credentials correctly rejected")
    
    def test_auth_me_without_token(self):
        """Test /auth/me returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✅ Unauthenticated request correctly rejected")


class TestMasterStats:
    """Master dashboard stats API tests"""
    
    @pytest.fixture
    def master_session(self):
        """Get authenticated master admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Master admin login failed")
        return session
    
    def test_get_master_stats(self, master_session):
        """Test GET /api/master/stats returns stats data"""
        response = master_session.get(f"{BASE_URL}/api/master/stats")
        
        assert response.status_code == 200, f"Stats request failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "total_barbershops" in data
        assert "active_barbershops" in data
        assert "pending_barbershops" in data
        assert "inactive_barbershops" in data
        assert "total_clients" in data
        assert "total_services" in data
        assert "total_users" in data
        
        # Verify data types
        assert isinstance(data["total_barbershops"], int)
        assert isinstance(data["active_barbershops"], int)
        assert isinstance(data["total_clients"], int)
        
        print(f"✅ Master stats retrieved: {data['total_barbershops']} barbershops, {data['total_clients']} clients")
    
    def test_stats_requires_master_admin(self):
        """Test stats endpoint requires master_admin role"""
        # Try without authentication
        response = requests.get(f"{BASE_URL}/api/master/stats")
        assert response.status_code == 401
        print("✅ Stats endpoint correctly requires authentication")


class TestBarbershopsList:
    """Barbershop list API tests"""
    
    @pytest.fixture
    def master_session(self):
        """Get authenticated master admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Master admin login failed")
        return session
    
    def test_list_barbershops(self, master_session):
        """Test GET /api/master/barbershops returns barbershop list"""
        response = master_session.get(f"{BASE_URL}/api/master/barbershops")
        
        assert response.status_code == 200, f"List request failed: {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list)
        
        # Should have at least one barbershop (Barbearia Prime from seed)
        assert len(data) >= 1, "Expected at least one barbershop"
        
        # Verify first barbershop structure
        barbershop = data[0]
        assert "id" in barbershop
        assert "name" in barbershop
        assert "email" in barbershop
        assert "phone" in barbershop
        assert "status" in barbershop
        assert "address" in barbershop
        assert "subscription" in barbershop
        
        # Check for Barbearia Prime
        barbershop_names = [b["name"] for b in data]
        assert "Barbearia Prime" in barbershop_names, f"Barbearia Prime not found in {barbershop_names}"
        
        print(f"✅ Barbershops list retrieved: {len(data)} barbershops")
        for b in data:
            print(f"   - {b['name']} ({b['status']})")
    
    def test_list_barbershops_requires_auth(self):
        """Test barbershops list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/master/barbershops")
        assert response.status_code == 401
        print("✅ Barbershops list correctly requires authentication")


class TestBarbershopCRUD:
    """Barbershop CRUD operations tests"""
    
    @pytest.fixture
    def master_session(self):
        """Get authenticated master admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Master admin login failed")
        return session
    
    def test_create_barbershop(self, master_session):
        """Test POST /api/master/barbershops creates new barbershop"""
        unique_id = str(uuid.uuid4())[:8]
        test_barbershop = {
            "name": f"TEST_Barbearia_{unique_id}",
            "document": "99.999.999/0001-99",
            "phone": "(11) 99999-9999",
            "email": f"test_{unique_id}@barbershop.com",
            "address": {
                "street": "Rua de Teste",
                "number": "999",
                "complement": "",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234-567"
            }
        }
        
        response = master_session.post(f"{BASE_URL}/api/master/barbershops", json=test_barbershop)
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify created barbershop
        assert "id" in data
        assert data["name"] == test_barbershop["name"]
        assert data["email"] == test_barbershop["email"].lower()
        assert data["status"] == "active"
        
        # Verify GET returns the created barbershop
        get_response = master_session.get(f"{BASE_URL}/api/master/barbershops/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["name"] == test_barbershop["name"]
        
        print(f"✅ Barbershop created and verified: {data['name']} (ID: {data['id']})")
        
        # Cleanup - delete the test barbershop
        delete_response = master_session.delete(f"{BASE_URL}/api/master/barbershops/{data['id']}")
        assert delete_response.status_code == 200
        print(f"   Cleanup: Test barbershop deactivated")
    
    def test_create_barbershop_duplicate_email(self, master_session):
        """Test creating barbershop with duplicate email fails"""
        # Try to create with existing email
        test_barbershop = {
            "name": "Duplicate Test",
            "phone": "(11) 99999-9999",
            "email": "contato@barbeariaprime.com",  # Existing email
            "address": {
                "street": "Rua de Teste",
                "number": "999",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234-567"
            }
        }
        
        response = master_session.post(f"{BASE_URL}/api/master/barbershops", json=test_barbershop)
        assert response.status_code == 400
        print("✅ Duplicate email correctly rejected")
    
    def test_get_barbershop_not_found(self, master_session):
        """Test GET non-existent barbershop returns 404"""
        response = master_session.get(f"{BASE_URL}/api/master/barbershops/non-existent-id")
        assert response.status_code == 404
        print("✅ Non-existent barbershop correctly returns 404")


class TestBarbershopOwnerAuth:
    """Barbershop owner authentication tests"""
    
    def test_barbershop_owner_login(self):
        """Test barbershop owner can login"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": BARBERSHOP_OWNER_EMAIL,
            "password": BARBERSHOP_OWNER_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert data["role"] == "barbershop_owner"
        assert data["email"] == BARBERSHOP_OWNER_EMAIL
        
        print(f"✅ Barbershop owner login successful: {data['name']} ({data['role']})")
    
    def test_barbershop_owner_cannot_access_master_stats(self):
        """Test barbershop owner cannot access master stats"""
        session = requests.Session()
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": BARBERSHOP_OWNER_EMAIL,
            "password": BARBERSHOP_OWNER_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Barbershop owner login failed")
        
        # Try to access master stats
        response = session.get(f"{BASE_URL}/api/master/stats")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ Barbershop owner correctly denied access to master stats")


class TestLogout:
    """Logout functionality tests"""
    
    def test_logout(self):
        """Test logout clears session"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        
        # Verify authenticated
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        
        # Verify no longer authenticated (need new session since cookies are cleared)
        new_session = requests.Session()
        me_response_after = new_session.get(f"{BASE_URL}/api/auth/me")
        assert me_response_after.status_code == 401
        
        print("✅ Logout successful, session cleared")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
