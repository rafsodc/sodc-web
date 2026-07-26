# Managing section files

Section moderators can select **Administer** on a section and then **Manage
Files**. Global administrators can do the same for any section.

## Upload

1. Choose an approved file of no more than 25 MB.
2. Enter the name members should see and, optionally, a description.
3. Select **Upload and verify**.
4. Keep the page open while it shows **Uploading** and then **Verifying**.

The file does not appear to members until the backend has checked its size,
declared type, actual file signature, and storage location. If final verification
fails, correct the file and retry; do not assume that an uploaded object is live.

## Links and changes

**Copy stable link** copies the application URL, not a temporary Storage URL.
The link is suitable for email and continues to re-check the recipient's enabled
account and current section access whenever it is opened.

Editing the display name or description does not change the stable link.
Replacing a file keeps the current version available until the replacement is
uploaded and verified. If replacement fails, refresh before retrying.

Deleting requires confirmation. The file is hidden before storage cleanup, so
members and previously emailed links stop working immediately even if backend
cleanup needs to be retried.

All permissions are enforced by the backend. Seeing the management screen is
not itself authority to upload or change a file.
