# How to Release a New Build

GitHub Actions automatically builds Windows (.exe + .zip) and Mac (.dmg) installers
whenever a version tag is pushed. No manual build step required.

## Steps

1. Make your changes and commit them:
   ```
   git add .
   git commit -m "your changes"
   git push origin master:main
   ```

2. Tag the release (increment the version as needed):
   ```
   git tag v0.1.1
   ```
   Follow semver: `v<major>.<minor>.<patch>`

3. Push the tag to trigger the build:
   ```
   git push origin master:main --tags
   ```

4. GitHub Actions will:
   - Build the Windows installer (.exe) and portable (.zip) on `windows-latest`
   - Build the Mac disk image (.dmg) on `macos-latest`
   - Create a GitHub Release with all three files attached

5. Find the release (with download links) at:
   **https://github.com/ecj15-bro/VAR-Scraper/releases**

## Notes

- Builds take ~10–15 minutes (Next.js compile + Electron packaging on two platforms)
- Apps are unsigned — Windows will show a SmartScreen warning on first run (click "More info → Run anyway")
- Mac will show a Gatekeeper warning — right-click the .dmg → Open to bypass
- To skip a release, just don't push a tag
