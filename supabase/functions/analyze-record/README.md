# analyze-record Edge Function

Analyzes one field photo with Google Gemini and returns a small, validated suggestion for the mobile form. It supports hazard and flora records. Soil and water records have no AI assist: the reading must come from the instrument. The Google API key stays in Supabase and is never shipped in the app. The function uses Google's Interactions API (`/v1beta/interactions`).

## One-time setup

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in to the Supabase CLI:

   ```powershell
   npx supabase login
   ```

3. Store the key as a Supabase secret. Replace the value with your real key:

   ```powershell
   npx supabase secrets set GOOGLE_AI_STUDIO_KEY=your-key-here --project-ref bjlyskwoxpepbwaxfc
   ```

4. Deploy the function:

   ```powershell
   npx supabase functions deploy analyze-record --project-ref bjlyskwoxpepbwaxfc --use-api
   ```

The default model is `gemini-3.8-flash`. To use another model, set `GEMINI_MODEL` as an additional secret before deploying:

```powershell
npx supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite --project-ref bjlyskwoxpepbwaxfc
```

This project currently uses `gemini-3.5-flash-lite` because `gemini-3.8-flash` was returning temporary `503` high-demand errors during testing. Remove the secret to fall back to the code default:

```powershell
npx supabase secrets unset GEMINI_MODEL --project-ref bjlyskwoxpepbwaxfc
```

## Request

```json
{
  "recordType": "hazard",
  "imageBase64": "...",
  "mimeType": "image/jpeg"
}
```

`recordType` must be `"hazard"` or `"flora"`. The mobile app only sends the first photo of a record.

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
    "title": "Bird's Nest Fern",
    "species_name": "Asplenium nidus",
    "growth_stage": "Mature",
    "health_condition": "Healthy",
    "estimated_count": 3,
    "notes": "Large rosette of undivided fronds growing on a shaded tree trunk.",
    "confidence": 0.82
  }
}
```

The mobile app validates the values again and shows a review sheet. Nothing is saved until the worker taps **Apply suggestions** and then saves the record. Only blank fields are filled.

## Flora identification rules

- The model identifies the plant as precisely as the photo allows.
- If the exact species is uncertain, it uses the genus (`Ficus sp.`) or the plant family (`Fern family`) instead of returning nothing.
- The 20-entry species catalog in `mobile/src/lib/species.ts` is only a shortcut for the form. It is not a restriction: a plant outside the catalog is still suggested as free text.
- If the model returns a local alias such as `Paku resam`, the mobile app maps it to the catalog's scientific name.

## Validation rules

- Hazard categories and severities are fixed in the function. Anything else is removed before the response.
- Flora growth stages and health conditions are fixed in the function. Anything else is removed before the response.
- The function returns `422` with `code: "unclear_photo"` when the photo does not support any suggestion.

## Error codes

| Status | `code` | Meaning | What the worker should do |
| --- | --- | --- | --- |
| 429 | `rate_limited` | Too many requests in the last minute, or a spend cap was hit. | Wait about a minute and try again. |
| 429 | `quota_exhausted` | The daily quota for the model is used up. | Enter the record manually; retrying soon will not help. |
| 503 | `busy` | Google's model is overloaded. | Wait about a minute and try again. |
| 422 | `unclear_photo` | The photo does not support any suggestion. | Take a clearer photo. |
| 413 | `image_too_large` | The photo is above the size limit. | Use another photo. |
| 502 | `analysis_failed` | Google returned an error, or the reply could not be read. | Try once more, then enter manually. |
| 503 | `not_configured` | The API key or model is missing on the server. | Ask an administrator. |

The function tells a daily quota apart from a per-minute one by reading the quota name in Google's `429` body (`...PerDay...` versus `...PerMinute...`). Daily quotas reset at midnight Pacific time, which is about 3 pm in Malaysia.

## Notes

- Only JPEG, PNG, and WebP photos are accepted.
- The request is rejected above roughly 1.5 MB of image data.
- The function checks the signed-in user and rejects inactive or non-approved profiles when the service role key is available.
- Check Google AI Studio's data-use terms before sending real field photos. If the photos are sensitive, use a provider or plan with suitable data terms.
- There is no database migration for this feature.
- The previous `analyze-hazard` function may still be deployed for older app builds. It can be removed after every device has the new preview update.
