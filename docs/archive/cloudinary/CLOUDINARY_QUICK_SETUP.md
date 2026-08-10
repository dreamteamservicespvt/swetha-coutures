# 🚀 Quick Cloudinary Setup Guide

## ⚠️ ERROR FIX: VITE_CLOUDINARY_CLOUD_NAME is not set

You're seeing this error because Cloudinary is not configured yet. Follow these simple steps to fix it:

---

## ✅ 5-Minute Setup (Follow in Order)

### STEP 1️⃣: Create Cloudinary Account (2 minutes)

1. Go to: https://cloudinary.com/users/register_free
2. Sign up with your email (it's FREE forever!)
3. Verify your email
4. Login to dashboard

---

### STEP 2️⃣: Get Your Cloud Name (30 seconds)

1. Once logged in, you'll see the **Dashboard**
2. At the top, you'll see: **"Cloud name: dxxxyyyzz"**
3. **Copy that cloud name** (e.g., "dab3m2u7x")
4. Keep it handy for next step

**Screenshot location:**
```
Cloudinary Dashboard → Top section → "Cloud name: YOUR_NAME_HERE"
```

---

### STEP 3️⃣: Create Upload Preset (1 minute)

1. Click the **Settings** icon (⚙️ gear icon) at bottom left
2. Click the **"Upload"** tab
3. Scroll down to **"Upload presets"** section
4. Click **"Add upload preset"** button
5. Fill in:
   - **Preset name:** `swetha_coutures`
   - **Signing Mode:** Select **"Unsigned"** ⚠️ THIS IS CRITICAL!
   - **Folder:** `payment_screenshots`
6. Click **"Save"**

**Why "Unsigned"?**
- Allows uploads directly from browser without backend signature
- Safe for public uploads with proper security settings
- Required for our implementation

---

### STEP 4️⃣: Update .env File (1 minute)

1. Open the `.env` file in your project root
   - Location: `swetha-coutures/.env`
2. Find this line:
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
   ```
3. Replace `your-cloud-name` with YOUR actual cloud name from Step 2
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=dab3m2u7x
   ```
   (Use YOUR cloud name, not this example!)
4. **Save the file** (Ctrl+S)

---

### STEP 5️⃣: Restart Dev Server (30 seconds)

1. Go to your terminal
2. **Stop the server:** Press `Ctrl+C`
3. **Start again:** Run `npm run dev`
4. Wait for server to start

**Why restart?**
- Environment variables are loaded when server starts
- Changes to `.env` require a restart to take effect

---

## 🧪 Test It Out!

1. Open the customer shared bill link
2. Click **"Upload Payment Screenshot"**
3. Select an image
4. Preview should appear
5. Click **"Confirm & Upload"**
6. Should see success message! ✅

---

## ❌ Troubleshooting

### Still seeing "VITE_CLOUDINARY_CLOUD_NAME is not set"?

**Check:**
1. ✅ Is `.env` file saved?
2. ✅ Did you replace "your-cloud-name" with actual value?
3. ✅ Did you restart the dev server?
4. ✅ Is the cloud name correct (no typos)?

**Common mistakes:**
- ❌ Forgot to save `.env` file
- ❌ Didn't restart server after editing `.env`
- ❌ Copied cloud name with spaces or quotes
- ❌ File named `.env.example` instead of `.env`

---

### Error: "Upload failed with status 400"?

**Check:**
1. ✅ Is upload preset created in Cloudinary?
2. ✅ Is preset name exactly: `swetha_coutures`
3. ✅ Is Signing Mode set to **"Unsigned"**?
4. ✅ Is cloud name correct?

**Fix:**
- Go back to Cloudinary Dashboard → Settings → Upload
- Check the upload preset settings
- Make sure it's "Unsigned"

---

### Error: "Invalid upload preset"?

**Fix:**
1. Go to Cloudinary Dashboard
2. Settings → Upload tab
3. Find preset `swetha_coutures`
4. Make sure it exists
5. Make sure "Signing Mode" is **"Unsigned"**
6. If doesn't exist, create it (see Step 3)

---

## 📝 Quick Checklist

Before testing, make sure:

- [ ] Cloudinary account created
- [ ] Cloud name copied from dashboard
- [ ] Upload preset `swetha_coutures` created
- [ ] Preset set to "Unsigned" mode
- [ ] `.env` file updated with cloud name
- [ ] `.env` file saved
- [ ] Dev server restarted
- [ ] Tested upload in customer view

---

## 🎯 Expected Result

After setup:

1. **Customer clicks upload:** File picker opens
2. **Customer selects image:** Preview dialog appears
3. **Customer clicks confirm:** Upload happens
4. **Success toast:** "Screenshot Uploaded"
5. **Screenshot visible:** In customer view and admin panel
6. **Image stored:** In Cloudinary Media Library

---

## 🆘 Still Need Help?

If you followed all steps and it's still not working:

1. **Check browser console** for error messages
2. **Check terminal** for server errors
3. **Verify .env file** is in correct location
4. **Check Cloudinary dashboard** for recent uploads
5. **Try in incognito mode** to rule out cache issues

---

## 📚 Additional Resources

- **Cloudinary Dashboard:** https://cloudinary.com/console
- **Cloudinary Documentation:** https://cloudinary.com/documentation
- **Upload Presets Guide:** https://cloudinary.com/documentation/upload_presets

---

## ✨ Summary

**The Fix:**
1. Create Cloudinary account (FREE)
2. Get cloud name from dashboard
3. Create upload preset (Unsigned mode)
4. Update `.env` with cloud name
5. Restart dev server
6. Test upload - should work! 🎉

**Time Required:** 5 minutes
**Cost:** FREE
**Difficulty:** Easy

---

**Need more details?** Check `CLOUDINARY_SETUP_REQUIRED.md` for comprehensive guide.
