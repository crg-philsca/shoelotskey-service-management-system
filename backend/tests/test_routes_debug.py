import requests

def test_routes():
    try:
        resp = requests.get('http://127.0.0.1:8000/openapi.json')
        print('OpenAPI status:', resp.status_code)
        if resp.status_code == 200:
            paths = list(resp.json().get('paths', {}).keys())
            report_paths = [p for p in paths if 'report' in p]
            print('Found report paths:', report_paths)
            print('Total registered paths:', len(paths))
    except Exception as e:
        print('Exception:', e)

if __name__ == '__main__':
    test_routes()
