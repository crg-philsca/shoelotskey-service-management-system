import requests

def test_export():
    try:
        login_resp = requests.post('http://127.0.0.1:8000/api/login', json={'username': 'admin', 'password': '@Admin123!'})
        print('Login status:', login_resp.status_code)
        data = login_resp.json()
        token = data.get('access_token')
        print('Access Token:', token[:20] if token else None)

        headers = {'Authorization': f'Bearer {token}'}

        # Test direct backend export-xlsx
        resp = requests.get('http://127.0.0.1:8000/api/reports/export-xlsx?report_type=Sales+Report&period_type=Daily', headers=headers)
        print('export-xlsx direct status:', resp.status_code)
        if resp.status_code != 200:
            print('export-xlsx direct error:', resp.text[:400])
        else:
            print('export-xlsx direct SUCCESS! Content-Type:', resp.headers.get('content-type'), 'Length:', len(resp.content))

        # Test Vite proxy export-xlsx
        vite_resp = requests.get('http://localhost:5173/api/reports/export-xlsx?report_type=Sales+Report&period_type=Daily', headers=headers)
        print('Vite proxy status:', vite_resp.status_code)
        if vite_resp.status_code != 200:
            print('Vite proxy error:', vite_resp.text[:400])
        else:
            print('Vite proxy SUCCESS! Length:', len(vite_resp.content))

    except Exception as e:
        print('Exception:', e)

if __name__ == '__main__':
    test_export()
