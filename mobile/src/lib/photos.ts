// Photo capture: pick from the camera or library, shrink the image, and copy
// it into the app's own storage so it survives until upload.
//
// A phone camera produces 3-10 MB photos. Uploading those over a village
// connection is slow and storage fills quickly, so every photo is resized and
// re-encoded here, before it is saved to SQLite or Supabase Storage.
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Directory, File, Paths } from "expo-file-system";
import { Image } from "react-native";

// Long edge of the stored image. 1600 px is sharp on a phone screen and still
// legible when a supervisor zooms in on a damaged leaf.
const MAX_EDGE = 1600;
const QUALITY = 0.6;
// If the first pass is still bulky (very detailed grass, for example), a second,
// stronger pass brings it down without making it useless.
const TARGET_BYTES = 500 * 1024;
const FALLBACK_EDGE = 1280;
const FALLBACK_QUALITY = 0.45;

export interface CapturedPhoto {
  uri: string;
  originalBytes: number;
  bytes: number;
}

// Photos are kept in a folder inside the app's document directory.
// Built on demand so we never touch the filesystem before it is ready.
function photoDir(): Directory {
  return new Directory(Paths.document, "record-photos");
}

function ensureDir(): Directory {
  const dir = photoDir();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function fileSize(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

function getDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 })
    );
  });
}

// Resize so the LONG edge is at most `longEdge`, never upscaling.
async function shrink(
  uri: string,
  longEdge: number,
  quality: number
): Promise<ImageManipulator.ImageResult> {
  const { width, height } = await getDimensions(uri);
  const actions: ImageManipulator.Action[] = [];

  if (width > 0 && height > 0) {
    if (width >= height && width > longEdge) actions.push({ resize: { width: longEdge } });
    else if (height > width && height > longEdge) actions.push({ resize: { height: longEdge } });
  } else {
    // No dimensions available: the old behaviour is still better than nothing.
    actions.push({ resize: { width: longEdge } });
  }

  return ImageManipulator.manipulateAsync(uri, actions, {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });
}

async function compress(uri: string): Promise<CapturedPhoto> {
  const originalBytes = fileSize(uri);

  let result = await shrink(uri, MAX_EDGE, QUALITY);
  let bytes = fileSize(result.uri);

  if (bytes > TARGET_BYTES) {
    const smaller = await shrink(result.uri, FALLBACK_EDGE, FALLBACK_QUALITY);
    const smallerBytes = fileSize(smaller.uri);
    if (smallerBytes > 0 && smallerBytes < bytes) {
      result = smaller;
      bytes = smallerBytes;
    }
  }

  const persisted = await persist(result.uri);
  return { uri: persisted, originalBytes, bytes: fileSize(persisted) || bytes };
}

async function persist(uri: string): Promise<string> {
  const dir = ensureDir();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const target = new File(dir, name);
  await new File(uri).copy(target);
  return target.uri;
}

export async function captureFromCamera(): Promise<CapturedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  return compress(result.assets[0].uri);
}

export async function pickFromLibrary(): Promise<CapturedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  return compress(result.assets[0].uri);
}

export async function deletePhoto(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
