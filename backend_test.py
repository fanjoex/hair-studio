import requests
import sys
import base64
import os
from datetime import datetime
import json

class HairBeardStudioAPITester:
    def __init__(self, base_url="https://virtual-barber-8.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.photo_id = None
        self.style_id = None
        self.result_id = None
        self.session = requests.Session()  # Use session to maintain cookies
        self.user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = self.session.post(url, files=files)
                else:
                    response = self.session.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_test_image(self):
        """Create a simple test image in base64 format"""
        # Create a minimal PNG image (1x1 pixel)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xdd\x8d\xb4\x1c\x00\x00\x00\x00IEND\xaeB`\x82'
        return png_data

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_upload_photo(self):
        """Test photo upload"""
        test_image = self.create_test_image()
        files = {'file': ('test_photo.png', test_image, 'image/png')}
        
        success, response = self.run_test(
            "Upload Photo",
            "POST",
            "upload-photo",
            200,
            files=files
        )
        
        if success and 'photo_id' in response:
            self.photo_id = response['photo_id']
            print(f"   Photo ID: {self.photo_id}")
            return True
        return False

    def test_get_styles(self):
        """Test getting style catalog"""
        success, response = self.run_test(
            "Get Styles",
            "GET",
            "styles",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            # Check if we have both hair and beard styles
            hair_styles = [s for s in response if s.get('category') == 'hair']
            beard_styles = [s for s in response if s.get('category') == 'beard']
            
            print(f"   Found {len(hair_styles)} hair styles and {len(beard_styles)} beard styles")
            
            if len(hair_styles) >= 12 and len(beard_styles) >= 12:
                self.style_id = response[0]['id']  # Use first style for testing
                print(f"   Using style ID: {self.style_id} ({response[0]['name']})")
                return True
            else:
                print(f"   ❌ Expected at least 12 hair and 12 beard styles")
                return False
        return False

    def test_generate_style(self):
        """Test AI style generation"""
        if not self.photo_id or not self.style_id:
            print("❌ Cannot test generation - missing photo_id or style_id")
            return False
        
        success, response = self.run_test(
            "Generate AI Style",
            "POST",
            "generate",
            200,
            data={
                "photo_id": self.photo_id,
                "style_id": self.style_id
            }
        )
        
        if success and 'id' in response:
            self.result_id = response['id']
            print(f"   Result ID: {self.result_id}")
            
            # Check if response has required fields
            required_fields = ['original_image', 'generated_image', 'style_name']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"   ❌ Missing fields: {missing_fields}")
                return False
            
            print(f"   Style applied: {response['style_name']}")
            return True
        return False

    def test_get_history(self):
        """Test getting generation history"""
        success, response = self.run_test(
            "Get History",
            "GET",
            "history",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} history items")
            return True
        return False

    def test_get_result(self):
        """Test getting specific result"""
        if not self.result_id:
            print("❌ Cannot test get result - missing result_id")
            return False
        
        success, response = self.run_test(
            "Get Result by ID",
            "GET",
            f"result/{self.result_id}",
            200
        )
        
        if success and 'id' in response:
            print(f"   Retrieved result: {response['style_name']}")
            return True
        return False

    # NEW AUTHENTICATION TESTS
    def test_register_user(self):
        """Test user registration"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@test.com"
        success, response = self.run_test(
            "Register New User",
            "POST",
            "auth/register",
            200,
            data={
                "name": "Test User",
                "email": test_email,
                "password": "testpass123"
            }
        )
        
        if success and 'id' in response:
            self.user_id = response['id']
            print(f"   User registered with ID: {self.user_id}")
            print(f"   User email: {response['email']}")
            return True
        return False

    def test_login_admin(self):
        """Test admin login with credentials from test_credentials.md"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": "admin@hairbeard.studio",
                "password": "admin123"
            }
        )
        
        if success and 'id' in response:
            self.user_id = response['id']
            print(f"   Admin logged in with ID: {self.user_id}")
            print(f"   Admin role: {response.get('role', 'user')}")
            return True
        return False

    def test_get_current_user(self):
        """Test getting current authenticated user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success and 'id' in response:
            print(f"   Current user: {response['name']} ({response['email']})")
            return True
        return False

    def test_logout(self):
        """Test user logout"""
        success, response = self.run_test(
            "User Logout",
            "POST",
            "auth/logout",
            200
        )
        
        if success:
            print("   User logged out successfully")
            return True
        return False

    # NEW FAVORITES TESTS
    def test_toggle_favorite(self):
        """Test toggling style favorite"""
        if not self.style_id:
            print("❌ Cannot test favorite - missing style_id")
            return False
        
        success, response = self.run_test(
            "Toggle Style Favorite",
            "POST",
            f"styles/{self.style_id}/favorite",
            200
        )
        
        if success and 'favorited' in response:
            print(f"   Style favorited: {response['favorited']}")
            return True
        return False

    # NEW PUBLIC GALLERY TESTS
    def test_get_public_gallery(self):
        """Test getting public gallery"""
        success, response = self.run_test(
            "Get Public Gallery",
            "GET",
            "gallery/public",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} public results")
            return True
        return False

    def test_toggle_result_public(self):
        """Test toggling result public status"""
        if not self.result_id:
            print("❌ Cannot test public toggle - missing result_id")
            return False
        
        success, response = self.run_test(
            "Toggle Result Public",
            "POST",
            f"result/{self.result_id}/public",
            200
        )
        
        if success and 'is_public' in response:
            print(f"   Result is now public: {response['is_public']}")
            return True
        return False

    def test_like_result(self):
        """Test liking a result"""
        if not self.result_id:
            print("❌ Cannot test like - missing result_id")
            return False
        
        success, response = self.run_test(
            "Like Result",
            "POST",
            f"result/{self.result_id}/like",
            200
        )
        
        if success and 'likes' in response:
            print(f"   Result now has {response['likes']} likes")
            return True
        return False

def main():
    print("🚀 Starting AI Hair & Beard Studio API Tests (Updated with Auth & Social Features)")
    print("=" * 70)
    
    tester = HairBeardStudioAPITester()
    
    # Run all tests in sequence
    tests = [
        # Basic API tests
        tester.test_root_endpoint,
        tester.test_get_styles,
        tester.test_upload_photo,
        
        # Authentication tests
        tester.test_register_user,
        tester.test_get_current_user,
        tester.test_logout,
        tester.test_login_admin,
        tester.test_get_current_user,
        
        # Core functionality tests (with auth)
        tester.test_generate_style,
        tester.test_get_history,
        tester.test_get_result,
        
        # Social features tests
        tester.test_toggle_favorite,
        tester.test_toggle_result_public,
        tester.test_get_public_gallery,
        tester.test_like_result,
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
            tester.tests_run += 1
    
    # Print final results
    print("\n" + "=" * 70)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())