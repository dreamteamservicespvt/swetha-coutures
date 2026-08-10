# Cloudinary Setup Guide for Payment Screenshots

## 🚀 Quick Setup (5 Minutes)

### **Step 1: Create Cloudinary Account**
1. Go to https://cloudinary.com
2. Click "Sign Up" (Free account is sufficient)
3. Verify your email
4. Complete profile setup

---

### **Step 2: Get Your Cloud Name**
1. Log in to Cloudinary Dashboard
2. Go to **Dashboard** (home page)
3. Look for **Cloud name** in the top section
4. Copy your cloud name (example: `dhxyz12abc`)

---

### **Step 3: Create Upload Preset**

1. **Navigate to Settings:**
   - Click the gear icon (Settings) in the top right
   - Or go to: https://cloudinary.com/console/settings/upload

2. **Go to Upload Tab:**
   - Click on **Upload** tab
   - Scroll to **Upload presets** section

3. **Add New Upload Preset:**
   - Click **"Add upload preset"** button
   
4. **Configure Upload Preset:**
   - **Upload preset name:** `swetha_coutures`
   - **Signing mode:** Select **"Unsigned"** ⚠️ (IMPORTANT!)
   - **Folder:** `payment_screenshots`
   - **Access mode:** Upload
   - **Delivery type:** Upload

5. **Save Preset:**
   - Click **Save** button at the top

---

### **Step 4: Update Environment Variables**

1. **Create `.env` file** in project root (if not exists)

2. **Add these lines:**
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name-here
   VITE_CLOUDINARY_UPLOAD_PRESET=swetha_coutures
   ```

3. **Replace `your-cloud-name-here`** with your actual cloud name from Step 2

**Example:**
```env
VITE_CLOUDINARY_CLOUD_NAME=dhxyz12abc
VITE_CLOUDINARY_UPLOAD_PRESET=swetha_coutures
```

---

### **Step 5: Restart Development Server**

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

---

## ✅ Verification

### **Test Upload:**
1. Open any bill in public view (`/view-bill/{token}`)
2. Click **"Upload Payment Screenshot"**
3. Select an image file
4. Should see success message
5. Check Cloudinary dashboard for uploaded image

### **Check Cloudinary Dashboard:**
1. Go to **Media Library**
2. Look for folder: `payment_screenshots`
3. Your uploaded image should be there

---

## 🔧 Troubleshooting

### **Error: "Upload Failed"**

**Cause 1:** Wrong cloud name
- **Fix:** Double-check cloud name in `.env`
- **Fix:** Restart dev server after changing `.env`

**Cause 2:** Upload preset not found
- **Fix:** Verify preset name is exactly `swetha_coutures`
- **Fix:** Check preset is **Unsigned** mode

**Cause 3:** Network/firewall issue
- **Fix:** Check internet connection
- **Fix:** Try disabling VPN/proxy

---

### **Error: "Invalid Credentials"**

**Fix:** 
- Upload preset MUST be in **Unsigned** mode
- Go back to Settings > Upload > Edit preset
- Change "Signing mode" to **Unsigned**
- Save and try again

---

### **Images Not Showing in Admin Panel**

**Fix:**
- Clear browser cache
- Refresh the bill details page
- Check if `paymentScreenshot` field exists in Firebase

---

## 📊 Free Tier Limits

Cloudinary Free Plan includes:
- ✅ 25 GB storage
- ✅ 25 GB bandwidth/month
- ✅ Unlimited transformations
- ✅ 25 credits/month

**This is more than enough for payment screenshots!**

---

## 🔐 Security Best Practices

### **Upload Restrictions (Optional but Recommended):**

1. **Set Max File Size:**
   - Edit preset > Advanced
   - Max File Size: 5 MB

2. **Allowed Formats:**
   - Edit preset > Advanced
   - Allowed formats: `jpg, png, jpeg, webp`

3. **Auto-Moderate:**
   - Edit preset > Advanced
   - Enable moderation (optional)

---

## 📝 Important Notes

1. **Never commit `.env` file to git!**
   - It's already in `.gitignore`
   - Only share cloud name, not credentials

2. **Unsigned uploads are safe because:**
   - No API secret in frontend code
   - Cloudinary validates via preset
   - Limited to configured folder
   - Size and format restrictions apply

3. **Monitor usage:**
   - Check dashboard monthly
   - Free tier is generous
   - Upgrade if needed (rare for this use case)

---

## 🎉 You're All Set!

Your Cloudinary is now configured for payment screenshot uploads!

**Test it now:**
1. Share a bill to customer
2. Customer uploads payment screenshot
3. Admin views screenshot in bill details

---

## 📞 Need Help?

- **Cloudinary Docs:** https://cloudinary.com/documentation
- **Support:** https://support.cloudinary.com
- **Status:** https://status.cloudinary.com

---

**Setup Time:** ~5 minutes  
**Difficulty:** Easy  
**Cost:** Free (forever for basic usage)
