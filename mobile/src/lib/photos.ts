// Photo capture: pick from the camera or library, shrink the image, and copy
// it into the app's own storage so it survives until upload.
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Directory, File, Paths } from "expo-file-system";

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

// Resize to a max width of 1600px and compress to JPEG.
async function compress(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

async function persist(uri: string): Promise<string> {
  const dir = ensureDir();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const target = new File(dir, name);
  await new File(uri).copy(target);
  return target.uri;
}

export async function captureFromCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const compressed = await compress(result.assets[0].uri);
  return persist(compressed);
}

export async function pickFromLibrary(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const compressed = await compress(result.assets[0].uri);
  return persist(compressed);
}

export async function deletePhoto(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
