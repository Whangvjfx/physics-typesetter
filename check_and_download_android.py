import subprocess
import urllib.request
import json
import time
import os
import zipfile
import shutil

REPO = "Whangvjfx/physics-typesetter"

def get_gh_token():
    p = subprocess.Popen(['git', 'credential', 'fill'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = p.communicate('protocol=https\nhost=github.com\n\n')
    for line in stdout.splitlines():
        if line.startswith('password='):
            return line.split('password=', 1)[1].strip()
    return os.environ.get('GITHUB_TOKEN', '')

def main():
    token = get_gh_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Antigravity-Agent'
    }

    # 1. Find latest Android run on feature/nonlinear
    print("Finding latest 'Build Android APK' run on branch feature/nonlinear...")
    target_run = None
    for _ in range(12):
        try:
            url = f"https://api.github.com/repos/{REPO}/actions/runs?branch=feature/nonlinear"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                runs = data.get('workflow_runs', [])
            for r in runs:
                if r.get('name') == 'Build Android APK':
                    target_run = r
                    break
            if target_run:
                break
        except Exception as e:
            print(f"Error fetching runs: {e}")
        time.sleep(5)

    if not target_run:
        print("No 'Build Android APK' workflow run found on branch feature/nonlinear!")
        return False

    run_id = target_run['id']
    commit_msg = target_run.get('head_commit', {}).get('message', '').strip()
    commit_id = target_run.get('head_commit', {}).get('id', '')[:7]
    print(f"Monitoring Android Run: {run_id}")
    print(f"Workflow: {target_run.get('name')}")
    print(f"Commit: {commit_id} - {commit_msg}")

    # 2. Monitor until completed
    while True:
        check_url = f"https://api.github.com/repos/{REPO}/actions/runs/{run_id}"
        check_req = urllib.request.Request(check_url, headers=headers)
        try:
            with urllib.request.urlopen(check_req) as resp:
                run_info = json.loads(resp.read().decode('utf-8'))
                status = run_info.get('status')
                conclusion = run_info.get('conclusion')
                print(f"[{time.strftime('%H:%M:%S')}] Status: {status}, Conclusion: {conclusion}")
                if status == 'completed':
                    if conclusion != 'success':
                        print(f"Build failed with conclusion: {conclusion}")
                        return False
                    print("Build succeeded! Fetching artifacts...")
                    break
        except Exception as e:
            print(f"Error checking run: {e}")
        time.sleep(10)

    # 3. Fetch artifacts
    art_url = f"https://api.github.com/repos/{REPO}/actions/runs/{run_id}/artifacts"
    art_req = urllib.request.Request(art_url, headers=headers)
    with urllib.request.urlopen(art_req) as resp:
        art_data = json.loads(resp.read().decode('utf-8'))

    artifacts = art_data.get('artifacts', [])
    print(f"Found {len(artifacts)} artifact(s):")
    for a in artifacts:
        print(f"  - {a['id']}: {a['name']} ({a['size_in_bytes']} bytes)")

    if not artifacts:
        print("No artifacts found!")
        return False

    target_art = artifacts[0]
    artifact_id = target_art['id']

    zip_path = r"C:\Users\wb686\.gemini\antigravity\scratch\PhysicsTypesetter-Nonlinear-Android-APK.zip"
    print(f"Downloading artifact {artifact_id} via curl...")

    curl_cmd = [
        'curl.exe', '-L',
        '-H', f'Authorization: Bearer {token}',
        '-H', 'Accept: application/vnd.github+json',
        '--proxy', 'http://127.0.0.1:7890',
        '-o', zip_path,
        f"https://api.github.com/repos/{REPO}/actions/artifacts/{artifact_id}/zip"
    ]
    subprocess.run(curl_cmd, check=True)

    print("Download complete. Extracting APK...")
    extract_dir = r"C:\Users\wb686\.gemini\antigravity\scratch\apk_temp_nonlinear"
    if os.path.exists(extract_dir):
        shutil.rmtree(extract_dir)
    os.makedirs(extract_dir, exist_ok=True)

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)

    apk_file = None
    for root, dirs, files in os.walk(extract_dir):
        for f in files:
            if f.endswith('.apk'):
                apk_file = os.path.join(root, f)
                break

    if not apk_file:
        print("Error: No APK file found in extracted artifact!")
        return False

    apk_size = os.path.getsize(apk_file)
    print(f"Extracted APK: {apk_file} ({apk_size} bytes)")

    # 4. Deliver to Desktop locations
    targets = [
        r"C:\Users\wb686\Desktop\PhysicsTypesetter-Nonlinear.apk",
        r"C:\Users\wb686\Desktop\非线性\PhysicsTypesetter-Nonlinear.apk"
    ]

    for t in targets:
        os.makedirs(os.path.dirname(t), exist_ok=True)
        shutil.copy2(apk_file, t)
        print(f"Delivered: {t} ({os.path.getsize(t)} bytes)")

    print("SUCCESS: All deliverables placed on user Desktop!")
    return True

if __name__ == '__main__':
    main()
