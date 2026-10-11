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

class NoAuthRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new_req = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new_req and 'authorization' in [k.lower() for k in new_req.headers]:
            for k in list(new_req.headers.keys()):
                if k.lower() == 'authorization':
                    del new_req.headers[k]
        return new_req

def main():
    token = get_gh_token()
    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Antigravity-Agent'
    }

    # 1. Find latest run on feature/nonlinear
    url = f"https://api.github.com/repos/{REPO}/actions/runs?branch=feature/nonlinear"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        runs = data.get('workflow_runs', [])

    if not runs:
        print("No workflow runs found on branch feature/nonlinear!")
        return

    latest_run = runs[0]
    run_id = latest_run['id']
    commit_msg = latest_run.get('head_commit', {}).get('message', '').strip()
    commit_id = latest_run.get('head_commit', {}).get('id', '')[:7]
    print(f"Monitoring Latest Run: {run_id}")
    print(f"Workflow: {latest_run.get('name')}")
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
        time.sleep(15)

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
    download_url = target_art['archive_download_url']

    zip_path = r"C:\Users\wb686\.gemini\antigravity\scratch\PhysicsTypesetter-Nonlinear-iOS-IPA.zip"
    print(f"Downloading artifact {artifact_id} to {zip_path}...")

    opener = urllib.request.build_opener(NoAuthRedirectHandler)
    dl_req = urllib.request.Request(download_url, headers=headers)
    with opener.open(dl_req) as resp, open(zip_path, 'wb') as out_f:
        shutil.copyfileobj(resp, out_f)

    print("Download complete. Extracting IPA...")
    extract_dir = r"C:\Users\wb686\.gemini\antigravity\scratch\ipa_temp_nonlinear"
    if os.path.exists(extract_dir):
        shutil.rmtree(extract_dir)
    os.makedirs(extract_dir, exist_ok=True)

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)

    ipa_file = None
    for f in os.listdir(extract_dir):
        if f.endswith('.ipa'):
            ipa_file = os.path.join(extract_dir, f)
            break

    if not ipa_file:
        print("Error: No IPA file found in extracted artifact!")
        return False

    ipa_size = os.path.getsize(ipa_file)
    print(f"Extracted IPA: {ipa_file} ({ipa_size} bytes)")

    # 4. Deliver to Desktop locations
    targets = [
        r"C:\Users\wb686\Desktop\PhysicsTypesetter-Nonlinear.ipa",
        r"C:\Users\wb686\Desktop\非线性\PhysicsTypesetter-Nonlinear.ipa"
    ]

    for t in targets:
        os.makedirs(os.path.dirname(t), exist_ok=True)
        shutil.copy2(ipa_file, t)
        print(f"Delivered: {t} ({os.path.getsize(t)} bytes)")

    print("SUCCESS: All deliverables placed on user Desktop!")
    return True

if __name__ == '__main__':
    main()
