
// Cloudinary configuration for Swetha's Couture
export const CLOUDINARY_CONFIG = {
  cloudName: 'dvmrhs2ek',
  uploadPreset: 'swetha',
  apiUrl: 'https://api.cloudinary.com/v1_1/dvmrhs2ek/image/upload'
};

export const uploadToCloudinary = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    const response = await fetch(CLOUDINARY_CONFIG.apiUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.secure_url) {
      throw new Error('No secure URL returned from Cloudinary');
    }

    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image. Please try again.');
  }
};

export const uploadMultipleToCloudinary = async (files: FileList): Promise<string[]> => {
  const uploadPromises = Array.from(files).map(file => uploadToCloudinary(file));
  return Promise.all(uploadPromises);
};
