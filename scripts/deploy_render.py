#!/usr/bin/env python3
"""
Deploy Market Signal Application & Autonomous 24/7 Background Worker to Render
Repository: https://github.com/tspatel786/optionmarketchart
Project ID: prj-dbbhf4e7bikc738j76a0
Services:
  1. optionmarketchart-web (Static Dashboard)
  2. optionmarketchart-worker (24/7 Node Background Worker with /healthz)
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

STATIC_SVC_NAME = "optionmarketchart-web"
WORKER_SVC_NAME = "optionmarketchart-worker"

def deploy_or_create_service(service_name, service_type, headers, owner_id):
    print(f"\n---> Checking service: {service_name} ({service_type})...")
    resp = requests.get(f"{RENDER_API_BASE}/services?name={service_name}&limit=10", headers=headers)
    existing_svc = None

    if resp.status_code == 200:
        for s in resp.json():
            svc = s.get("service", {})
            if svc.get("name") == service_name:
                existing_svc = svc
                break

    if existing_svc:
        svc_id = existing_svc.get("id")
        live_url = existing_svc.get("serviceDetails", {}).get("url") or existing_svc.get("url")
        print(f"  [FOUND] Service ID: {svc_id}")
        print(f"  Triggering fresh deploy with cache clear...")
        d_resp = requests.post(
            f"{RENDER_API_BASE}/services/{svc_id}/deploys",
            headers=headers,
            json={"clearCache": "clear"}
        )
        if d_resp.status_code in (200, 201):
            d_data = d_resp.json()
            print(f"  [SUCCESS] Deploy Started! Deploy ID: {d_data.get('id')}")
            if live_url:
                print(f"  Live URL: {live_url}")
        else:
            print(f"  Deploy trigger response: HTTP {d_resp.status_code} - {d_resp.text}")
        return svc_id, live_url

    # Create service if not found
    print(f"  Service '{service_name}' not found. Creating new {service_type} on Render...")
    if service_type == "static_site":
        payload = {
            "type": "static_site",
            "name": service_name,
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
    else:
        # Node Web Service with 24/7 background worker & /healthz
        payload = {
            "type": "web_service",
            "name": service_name,
            "ownerId": owner_id,
            "repo": REPO_URL,
            "branch": BRANCH,
            "autoDeploy": "yes",
            "serviceDetails": {
                "env": "node",
                "plan": "starter",
                "envSpecificDetails": {
                    "buildCommand": "npm install && npm run build",
                    "startCommand": "npm run server"
                },
                "healthCheckPath": "/healthz",
                "pullRequestPreviewsEnabled": "no",
                "envVars": [
                    {"key": "NODE_ENV", "value": "production"}
                ]
            }
        }

    c_resp = requests.post(f"{RENDER_API_BASE}/services", headers=headers, json=payload)
    if c_resp.status_code in (200, 201):
        c_data = c_resp.json()
        svc_id = c_data.get("service", {}).get("id") or c_data.get("id")
        live_url = c_data.get("service", {}).get("serviceDetails", {}).get("url") or c_data.get("url")
        print(f"  [SUCCESS] Created '{service_name}'! Service ID: {svc_id}")
        if live_url:
            print(f"  Live URL: {live_url}")
        return svc_id, live_url
    else:
        print(f"  Failed to create '{service_name}': HTTP {c_resp.status_code} - {c_resp.text}")
        return None, None

def main():
    api_key = os.environ.get("RENDER_API_KEY")
    if not api_key and len(sys.argv) > 1:
        api_key = sys.argv[1].strip()

    if not api_key:
        api_key = "rnd_vA25FcjaDb6FdZnMIhxKkLutFb9m"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    print("=" * 70)
    print(" Autonomous Market Signal Platform — Render Production Deployment")
    print("=" * 70)

    # 1. Verify credentials
    me_resp = requests.get(f"{RENDER_API_BASE}/owners", headers=headers)
    if me_resp.status_code != 200:
        print(f"Authentication failed: HTTP {me_resp.status_code} - {me_resp.text}")
        return

    owners = me_resp.json()
    owner_id = owners[0].get("owner", {}).get("id") or owners[0].get("id")
    owner_name = owners[0].get("owner", {}).get("name", "Account Owner")
    print(f"[OK] Render Account: {owner_name} (ID: {owner_id})")

    # 2. Deploy Static Dashboard
    deploy_or_create_service(STATIC_SVC_NAME, "static_site", headers, owner_id)

    # 3. Deploy 24/7 Autonomous Background Worker
    deploy_or_create_service(WORKER_SVC_NAME, "web_service", headers, owner_id)

    print("\n" + "=" * 70)
    print(" Deployment Complete!")
    print("  • Web Dashboard: https://optionmarketchart-web.onrender.com")
    print("  • Custom Subdomain: https://livemarketchart.smpatelconstruction.in")
    print(f"  • Render Project: https://dashboard.render.com/project/{PROJECT_ID}")
    print("=" * 70)

if __name__ == "__main__":
    main()
