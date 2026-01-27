# 🚀 How to Connect Your Game to Vercel

You have successfully set up the **GitHub Pipeline**. Your code is now hosted at:
`https://github.com/adenkhan/TPD`

To make it live on the web (and auto-update whenever you run `deploy.bat`), follow these steps:

## Step 1: Sign Up / Log In to Vercel
1.  Go to [Vercel.com](https://vercel.com).
2.  Click **Sign Up** (or Log In).
3.  Choose **Continue with GitHub**. (This is important! It links your accounts).

## Step 2: Import Your Repository
1.  Once logged in, click the **"Add New..."** button (top right) and select **Project**.
2.  You will see a list of your GitHub repositories.
3.  Find `TPD` (or `adenkhan/TPD`) in the list.
4.  Click the **Import** button next to it.

## Step 3: Configure and Deploy
1.  Vercel will show a "Configure Project" screen.
2.  **Framework Preset**: It usually auto-detects. Since this is a vanilla JS/Phaser project (not Next.js/React), selecting **"Other"** or leaving it as default is usually fine.
    *   *Note: Vercel handles `index.html` automatically.*
3.  Click **Deploy**.

## Step 4: Success!
1.  Wait about 30-60 seconds.
2.  You will see a "Congratulations!" screen with a screenshot of your game.
3.  Click the **Visit** button to see your live URL (e.g., `tpd.vercel.app`).

---

## 🔄 How to Update
From now on, whenever you make changes:
1.  Double-click `deploy.bat` in your project folder.
2.  Wait for the green "Success" message.
3.  Vercel will automatically detect the change and update your live site within minute.
