
/**
 * Cloudinary configuration, read from environment variables.
 *
 * Uses an *unsigned* upload preset, so no API secret ever reaches the browser — the preset
 * name and cloud name are the only things needed, and both are safe to ship. Configure the
 * preset's allowed formats/size limits in the Cloudinary dashboard.
 */
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export const CLOUDINARY_CONFIG = {
  cloudName: cloudName || '',
  uploadPreset: uploadPreset || '',
  apiUrl: `https://api.cloudinary.com/v1_1/${cloudName || ''}/image/upload`,
};

export const isCloudinaryConfigured = (): boolean =>
  Boolean(CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset);

export const uploadToCloudinary = async (file: File): Promise<string> => {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Image uploads are not configured. Set VITE_CLOUDINARY_CLOUD_NAME and ' +
        'VITE_CLOUDINARY_UPLOAD_PRESET in your .env file, then restart the app.'
    );
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    const response = await fetch(CLOUDINARY_CONFIG.apiUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      // Cloudinary explains *why* it rejected an upload; surfacing that beats a bare status.
      let detail = `status ${response.status}`;
      try {
        const body = await response.json();
        if (body?.error?.message) detail = body.error.message;
      } catch {
        /* response was not JSON — keep the status */
      }
      throw new Error(`Cloudinary upload failed: ${detail}`);
    }

    const data = await response.json();

    if (!data.secure_url) {
      throw new Error('No secure URL returned from Cloudinary');
    }

    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error instanceof Error ? error : new Error('Failed to upload image. Please try again.');
  }
};

export const uploadMultipleToCloudinary = async (files: FileList): Promise<string[]> => {
  const uploadPromises = Array.from(files).map(file => uploadToCloudinary(file));
  return Promise.all(uploadPromises);
};
