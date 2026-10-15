// Photo capture: pick from the camera or library, shrink the image, and copy
// it into the app's own storage so it survives until upload.
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

const PHOTO_DIR = `${FileSystem.documentDirectory}record-photos/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
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
  await ensureDir();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const target = `${PHOTO_DIR}${name}`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
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
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}
