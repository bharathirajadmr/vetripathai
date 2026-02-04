# How to Add More Exams to the Library

To add a new exam (e.g., UPSC Prelims or NEET) to the selection list, follow these two steps:

### 1. Backend: Add the Syllabus Text
1. Go to `backend/data/syllabuses/`.
2. Create a new `.txt` file with a simple name (e.g., `upsc-prelims.txt`).
3. Paste the full syllabus text into this file.

### 2. Frontend: Update the Exam List
1. Open `d:\vetripathai-pro\constants\exams.ts`.
2. Add a new entry to the `EXAMS` array:

```typescript
{
    id: 'upsc-prelims', // Must match the filename (without .txt)
    name: 'UPSC Civil Services (Prelims)',
    category: 'UPSC', // For grouping in the UI
},
```

### 3. Deploy
1. **Push Backend**: Push the new `.txt` file to your Render repository.
2. **Build and Upload Frontend**: Run `npm run build` and upload the `dist` folder to update the list on your live site.
