# analyze-hazard Edge Function

Analyzes one hazard photo with Google Gemini and returns a small suggestion for the mobile form. The Google API key stays in Supabase and is never shipped in the app. The function uses Google's Interactions API (`/v1beta/interactions`).

## One-time setup

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in to the Supabase CLI:

   ```powershell
   npx supabase login
   ```

3. Store the key as a Supabase secret. Replace the value with your real key:

   ```powershell
   npx supabase secrets set GOOGLE_AI_STUDIO_KEY=your-key-here --project-ref bjlyskwoxpkvepbwaxfc
   ```

4. Deploy the function:

   ```powershell
   npx supabase functions deploy analyze-hazard --project-ref bjlyskwoxpkvepbwaxfc --use-api
   ```

The default model is `gemini-3.8-flash`. To use another model, set `GEMINI_MODEL` as an additional secret before deploying:

```powershell
npx supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite --project-ref bjlyskwoxpkvepbwaxfc
```

This project currently uses `gemini-3.5-flash-lite` because `gemini-3.8-flash` was returning temporary `503` high-demand errors during testing. Remove the secret to fall back to the code default:

```powershell
npx supabase secrets unset GEMINI_MODEL --project-ref bjlyskwoxpkvepbwaxfc
```

## What the function returns

```json
{
  "suggestion": {
    "title": "Blocked culvert near access road",
    "hazard_type": "Blocked drainage",
    "severity": "medium",
    "notes": "Water is pooling behind a clogged culvert beside the access road.",
    "confidence": 0.78
  }
}
```

The mobile app validates the values again and shows a review sheet. Nothing is saved until the worker taps **Apply suggestions** and then saves the record.

## Notes

- Only JPEG, PNG, and WebP photos are accepted.
- The request is rejected above roughly 1.5 MB of image data.
- The function checks the signed-in user and rejects inactive or non-approved profiles when the service role key is available.
- Check Google AI Studio's data-use terms before sending real field photos. If the photos are sensitive, use a provider or plan with suitable data terms.
- There is no database migration for this feature.
