# analyze-record Edge Function

Analyzes one field photo with Google Gemini and returns a small, validated suggestion for the mobile form. It supports hazard, flora, and soil/water records. The Google API key stays in Supabase and is never shipped in the app. The function uses Google's Interactions API (`/v1beta/interactions`).

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
   npx supabase functions deploy analyze-record --project-ref bjlyskwoxpkvepbwaxfc --use-api
   ```

The default model is `gemini-3.8-flash`. To use another model, set `GEMINI_MODEL` as an additional secret before deploying:

```powershell
npx supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite --project-ref bjlyskwoxpkvepbwaxfc
```

This project currently uses `gemini-3.5-flash-lite` because `gemini-3.8-flash` was returning temporary `503` high-demand errors during testing. Remove the secret to fall back to the code default:

```powershell
npx supabase secrets unset GEMINI_MODEL --project-ref bjlyskwoxpkvepbwaxfc
```

## Request

```json
{
  "recordType": "hazard",
  "imageBase64": "...",
  "mimeType": "image/jpeg"
}
```

`recordType` must be `"hazard"`, `"flora"`, or `"soil_water"`. The mobile app only sends the first photo of a record.

## Responses

Hazard:

```json
{
  "recordType": "hazard",
  "suggestion": {
    "title": "Blocked culvert near access road",
    "hazard_type": "Blocked drainage",
    "severity": "medium",
    "notes": "Water is pooling behind a clogged culvert beside the access road.",
    "confidence": 0.78
  }
}
```

Flora:

```json
{
  "recordType": "flora",
  "suggestion": {
    "species_name": "Dicranopteris linearis",
    "growth_stage": "Mature",
    "health_condition": "Healthy",
    "estimated_count": 12,
    "notes": "Dense stand of ferns on a sunny slope with no visible damage.",
    "confidence": 0.72
  }
}
```

Soil/water:

```json
{
  "recordType": "soil_water",
  "suggestion": {
    "reading_type": "pH",
    "reading_value": 6.8,
    "reading_unit": "pH",
    "notes": "A handheld pH meter display shows 6.8 at the wetland edge.",
    "confidence": 0.9
  }
}
```

The mobile app validates the values again and shows a review sheet. Nothing is saved until the worker taps **Apply suggestions** and then saves the record. Only blank fields are filled.

## Validation rules

- Hazard categories, severities, growth stages, health conditions, reading types, units, and ranges are fixed in the function. Anything else is removed before the response.
- Flora species must match the catalog in `mobile/src/lib/species.ts`. A name outside the catalog is dropped, never passed through.
- Soil/water values must be inside the range for the chosen unit. An unreadable or impossible value is returned as `null`, so the worker can type it.
- The function returns `422` with `code: "unclear_photo"` when the photo does not support any suggestion.

## Notes

- Only JPEG, PNG, and WebP photos are accepted.
- The request is rejected above roughly 1.5 MB of image data.
- The function checks the signed-in user and rejects inactive or non-approved profiles when the service role key is available.
- Check Google AI Studio's data-use terms before sending real field photos. If the photos are sensitive, use a provider or plan with suitable data terms.
- There is no database migration for this feature.
- The previous `analyze-hazard` function may still be deployed for older app builds. It can be removed after every device has the new preview update.
