# PacificBoard Media Storage

## Overview

PacificBoard supports uploading images and videos from the **Files** page. The uploaded media is stored directly in PacificDB and can be previewed in the browser without requiring a separate object-storage service.

The current implementation uses the existing `files` collection:

| Setting | Value |
|---|---|
| Database | `pacificboard` by default |
| Collection | `files` |
| Maximum file size | 50 MB |
| Supported media | Images and videos |
| Storage format | Base64 data URL stored in PacificDB |

The database name can be changed with `PACIFICDB_DBNAME` in `backend/.env`.

## PacificDB project and database

This application is the **PacificBoard** project. The PacificDB project used
by the repository is:

```text
project_6aac82acc9e681fba249ab88
```

Within that PacificDB project, the application database is:

```text
pacificboard
```

The media collection is:

```text
files
```

Other PacificBoard collections include `users`, `workspaces`, `projects`,
`tasks`, `messages`, `comments`, `activity`, `notifications`, and `vectors`.

### Verify from the PacificDB CLI

Run the PacificDB CLI with the engine already running:

```text
pacificdb.exe --no-start
use project project_6aac82acc9e681fba249ab88
use pacificboard
list collections
count files {}
quit
```

`list collections` should show `files` after database setup or the first
successful upload. `count files {}` shows how many media records are stored in
PacificDB for the current database. The repository setup command is:

```bash
cd backend
npm run setup:db
```

## How storage works

When a user uploads a file:

1. The frontend sends a multipart request to `POST /api/files/upload`.
2. The backend authenticates the user and reads the uploaded file into memory.
3. The file bytes are converted to a base64 data URL.
4. PacificBoard inserts the file metadata and data URL into the `files` collection in PacificDB.
5. The API returns the new file metadata and preview/download paths.

The stored document has this shape:

```json
{
  "_id": "generated-file-id",
  "workspaceId": "workspace-id",
  "taskId": null,
  "uploaderId": "user-id",
  "name": "demo-video.mp4",
  "mimeType": "video/mp4",
  "size": 1843200,
  "dataUrl": "data:video/mp4;base64,...",
  "createdAt": "2026-09-20T10:00:00.000Z"
}
```

PacificDB creates the `pacificboard` database and `files` collection when the first file document is inserted, provided the PacificDB service is running and reachable.

## API endpoints

All endpoints require a valid JWT bearer token.

### List files

```http
GET /api/files?workspaceId=<workspace-id>
```

Returns lightweight metadata only. The base64 payload is intentionally omitted from list responses so that the Files page remains fast even when many media files exist.

### Upload a file

```http
POST /api/files/upload
Content-Type: multipart/form-data
```

Form fields:

- `file`: the image or video file
- `workspaceId`: the destination workspace
- `taskId`: optional task to attach the file to

The backend accepts files up to 50 MB. The Files page restricts the file picker to `image/*` and `video/*`.

### Preview media

```http
GET /api/files/<file-id>/preview
```

Returns the stored data URL, filename, and MIME type. The frontend uses this response for image thumbnails, video thumbnails, and the full-screen preview viewer.

### Download media

```http
GET /api/files/<file-id>/download
```

Returns the original bytes with the stored MIME type and filename.

### Delete a file

```http
DELETE /api/files/<file-id>
```

Only the user who uploaded the file can delete it. Deleting a file removes its document from PacificDB.

## Viewing media in the application

The Files page loads normal file metadata first. For image and video records it then requests the preview endpoint and stores the returned data URL in frontend state.

- Images are rendered as thumbnail cards and can be opened in a full-screen viewer.
- Videos are rendered as thumbnail cards and can be played in the full-screen viewer with browser controls.
- Non-media files continue to appear with file-type icons and download controls.

The preview request is authenticated through the normal API client, so media is not exposed through an unauthenticated public URL.

## Local setup

1. Start PacificDB on the configured host and port, normally `127.0.0.1:9000`.
2. Copy `backend/.env.example` to `backend/.env` if needed.
3. Confirm these values:

   ```env
   PACIFICDB_HOST=127.0.0.1
   PACIFICDB_PORT=9000
   PACIFICDB_DBNAME=pacificboard
   PORT=4001
   FRONTEND_URL=http://localhost:5173
   ```

4. Start the backend with `npm run dev` from `backend/`.
5. Start the frontend with `npm run dev` from `frontend/`.
6. Sign in, open **Files**, choose **Upload Media**, and select an image or video.

No manual collection migration is required for the `files` collection. It is created on the first successful upload.

## Operational considerations

Base64 storage is convenient for the current local/demo deployment because all media remains inside PacificDB. It increases the stored representation by roughly one third and causes the full payload to be held in memory during upload and preview. The 50 MB upload limit protects the API and database from unexpectedly large requests.

For a production deployment with large media libraries, the storage implementation can be evolved to use PacificDB for metadata and a dedicated object-storage layer for file bytes while keeping the same API contract.
