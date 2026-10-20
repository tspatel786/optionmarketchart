#!/usr/bin/env python3
"""
Deploy Market Signal Application to Render using the official Render REST API.
Repository: https://github.com/tspatel786/optionmarketchart
Project ID: prj-dbbhf4e7bikc738j76a0
"""

import os
import sys
import json
try:
    import requests
except ImportError:
    print("Error: 'requests' module not found. Run: pip install requests")
    sys.exit(1)

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

RENDER_API_BASE = "https://api.render.com/v1"
PROJECT_ID = "prj-dbbhf4e7bikc738j76a0"
REPO_URL = "https://github.com/tspatel786/optionmarketchart"
BRANCH = "main"
SERVICE_NAME = "optionmarketchart-web"

def main():
    api_key = os.environ.get("RENDER_API_KEY")
    if not api_key and len(sys.argv) > 1:
        api_key = sys.argv[1].strip()

    if not api_key:
        print("=" * 65)
        print(" Render API Key Required for Deployment")
        print("=" * 65)
        print("Get your API Key from: https://dashboard.render.com/u/settings#api-keys")
        print("Then run:")
        print(f"  python scripts/deploy_render.py <YOUR_RENDER_API_KEY>")
        print("=" * 65)
        api_key = input("Enter Render API Key (or press Enter to exit): ").strip()
        if not api_key:
            print("Aborted. No API key provided.")
            return

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    print("\n[1/3] Verifying Render API Key...")
    me_resp = requests.get(f"{RENDER_API_BASE}/owners", headers=headers)
    if me_resp.status_code != 200:
        print(f"Error authenticating with Render: HTTP {me_resp.status_code}")
        print(me_resp.text)
        return

    owners = me_resp.json()
    if not owners:
        print("Error: No Render owners/accounts found for this key.")
        return

    owner_id = owners[0].get("owner", {}).get("id") or owners[0].get("id")
    owner_name = owners[0].get("owner", {}).get("name", "Account Owner")
    print(f"[OK] Authenticated as: {owner_name} (Owner ID: {owner_id})")

    print(f"\n[2/3] Checking Project {PROJECT_ID}...")
    proj_resp = requests.get(f"{RENDER_API_BASE}/projects/{PROJECT_ID}", headers=headers)
    if proj_resp.status_code == 200:
        proj_data = proj_resp.json()
        print(f"[OK] Project Found: {proj_data.get('name', 'Market Signal')}")
    else:
        print(f"Note: Could not inspect project {PROJECT_ID} directly (HTTP {proj_resp.status_code}). Proceeding...")

    print(f"\n[3/3] Checking existing service '{SERVICE_NAME}'...")
    services_resp = requests.get(f"{RENDER_API_BASE}/services?name={SERVICE_NAME}&limit=10", headers=headers)
    existing_service = None
    if services_resp.status_code == 200:
        for s in services_resp.json():
            svc = s.get("service", {})
            if svc.get("name") == SERVICE_NAME or svc.get("repo") == REPO_URL:
                existing_service = svc
                break

    if existing_service:
        service_id = existing_service.get("id")
        live_url = existing_service.get("serviceDetails", {}).get("url") or existing_service.get("url")
        print(f"[FOUND] Existing Service Found: {service_id}")
        print(f"Triggering new live deploy for latest commit on branch '{BRANCH}'...")
        deploy_resp = requests.post(f"{RENDER_API_BASE}/services/{service_id}/deploys", headers=headers, json={"clearCache": "clear"})
        if deploy_resp.status_code in (200, 201):
            d_data = deploy_resp.json()
            print(f"[SUCCESS] Deploy Triggered! Deploy ID: {d_data.get('id')}")
            if live_url:
                print(f"Live Application URL: {live_url}")
        else:
            print(f"Deploy response: HTTP {deploy_resp.status_code} - {deploy_resp.text}")
    else:
        # Create Static Site service
        print(f"Creating new Static Site service '{SERVICE_NAME}' on Render...")
        web_payload = {
            "type": "static_site",
            "name": SERVICE_NAME,
            "ownerId": owner_id,
            "repo": REPO_URL,
            "branch": BRANCH,
            "autoDeploy": "yes",
            "serviceDetails": {
                "buildCommand": "npm install && npm run build",
                "publishPath": "dist",
                "pullRequestPreviewsEnabled": "no",
                "routes": [
                    {"type": "rewrite", "source": "/*", "destination": "/index.html"}
                ]
            }
        }

        web_resp = requests.post(f"{RENDER_API_BASE}/services", headers=headers, json=web_payload)
        if web_resp.status_code in (200, 201):
            web_data = web_resp.json()
            service_id = web_data.get("service", {}).get("id") or web_data.get("id")
            service_url = web_data.get("service", {}).get("serviceDetails", {}).get("url") or web_data.get("url")
            print(f"[SUCCESS] {SERVICE_NAME} created successfully! Service ID: {service_id}")
            if service_url:
                print(f"Live URL: {service_url}")
        else:
            print(f"Failed to create service: HTTP {web_resp.status_code} - {web_resp.text}")

    print("\n" + "=" * 65)
    print(" Render Dashboard Links:")
    print(f"  • Service URL: https://dashboard.render.com/static/{SERVICE_NAME}")
    print(f"  • Project Hub: https://dashboard.render.com/project/{PROJECT_ID}")
    print("=" * 65)

if __name__ == "__main__":
    main()
