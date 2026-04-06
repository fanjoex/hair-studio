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

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)

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

def main():
    print("🚀 Starting AI Hair & Beard Studio API Tests")
    print("=" * 50)
    
    tester = HairBeardStudioAPITester()
    
    # Run all tests in sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_get_styles,
        tester.test_upload_photo,
        tester.test_generate_style,
        tester.test_get_history,
        tester.test_get_result
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
            tester.tests_run += 1
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())