deploy vless on webhostmost via JS(webhostmost_web.js and webhostmost_package.json)
keep the account login automatically
  1. Set up Secrets in your GitHub Repository:
  Go to your GitHub repository.
  Click on "Settings".
  Click on "Secrets and variables" -> "Actions".
  Click "New repository secret".
  Create the following secrets:
  WEBHOSTMOST_USERNAME: Your webhostmost username/email.
  WEBHOSTMOST_PASSWORD: Your webhostmost password.
  
3. Create a GitHub Actions Workflow File:
  Create a new file in your repository at .github/workflows/webhostmost_login.yml.
4. Workflow YAML File (.github/workflows/webhostmost_login.yml):
5. Node.js Script (webhostmost_check.js).



