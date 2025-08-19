# 🚀 Netlify Deployment Guide - Adaptive Book Hygiene

## 📋 Overview
This guide provides step-by-step instructions for deploying the Adaptive Book Hygiene React application to Netlify with complete CI/CD integration.

## ✅ Prerequisites
- [x] Git repository with main branch
- [x] Netlify account
- [x] All environment variables ready
- [x] Domain name (optional)

## 🔧 Configuration Files Created
- ✅ [`netlify.toml`](netlify.toml) - Complete Netlify configuration
- ✅ [`src/App.tsx`](src/App.tsx) - Fixed ClerkProvider import issue

## 🌍 Environment Variables Setup

### Required Variables for Netlify Dashboard
Copy these **exact** environment variables to your Netlify site settings:

#### Authentication & Database
```bash
VITE_CLERK_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

#### QBO Integration (8 Variables)
```bash
VITE_QBO_PROXY_BASE_URL=
VITE_QBO_REQUEST_TIMEOUT=30000
VITE_QBO_MAX_REQUESTS_PER_MINUTE=450
VITE_QBO_RETRY_DELAY_MS=1000
VITE_QBO_MAX_RETRIES=3
VITE_QBO_CLIENT_ID=
VITE_QBO_REDIRECT_URI=
VITE_QBO_SCOPE=com.intuit.quickbooks.accounting
VITE_QBO_POST_LOGIN_REDIRECT=
VITE_QBO_AUTH_BASE_URL=https://appcenter.intuit.com/connect/oauth2/authorize
```

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Connect Git Repository
1. Log into [Netlify Dashboard](https://app.netlify.com)
2. Click "New site from Git"
3. Choose your Git provider (GitHub/GitLab/Bitbucket)
4. Select your repository: `adaptive-book-hygience-poc`
5. Configure build settings:
   - **Branch to deploy**: `main`
   - **Build command**: `npm run build` (auto-detected)
   - **Publish directory**: `dist` (auto-detected)

### Step 2: Configure Environment Variables
1. Go to Site Settings → Environment Variables
2. Add all 11 environment variables listed above
3. **Critical**: Ensure all `VITE_` prefixed variables are exactly as shown
4. Save changes

### Step 3: Deploy & Test
1. Click "Deploy site" 
2. Monitor build logs for any errors
3. Test deployment at the generated Netlify URL
4. Verify all routes work (especially OAuth callback)

### Step 4: Custom Domain (Optional)
1. Go to Domain Management → Custom domains
2. Add your domain
3. Configure DNS records as instructed
4. Enable HTTPS (automatic with Netlify)

## 🧪 Testing Checklist

### Pre-Deployment Testing
```bash
# Test local build
npm run build
npm run preview

# Check bundle size
npm run build
ls -la dist/

# Verify environment variables are working
npm run dev
```

### Post-Deployment Testing
- [ ] Landing page loads correctly
- [ ] Clerk authentication works
- [ ] QBO OAuth flow completes successfully 
- [ ] All React Router routes function
- [ ] Assessment component loads customer data
- [ ] No console errors in browser
- [ ] Mobile responsiveness check

## 🔒 Security Configurations

### Headers Applied
- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff (prevents MIME attacks)
- **X-XSS-Protection**: enabled
- **Content-Security-Policy**: Configured for Clerk, Supabase, QBO APIs
- **Referrer-Policy**: strict-origin-when-cross-origin

### CORS Configuration
- Clerk authentication endpoints
- Supabase database connections
- N8N proxy for QBO API calls
- QuickBooks OAuth endpoints

## 🚨 Troubleshooting Guide

### Common Issues & Solutions

#### Build Fails
```bash
# Check Node version
node --version  # Should be 18+

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Environment Variables Not Working
- Ensure all variables start with `VITE_`
- Check for typos in variable names
- Verify values are exactly as provided (no extra spaces)
- Redeploy after adding variables

#### OAuth Callback Fails
- Verify `VITE_QBO_REDIRECT_URI` points to N8N proxy
- Check N8N proxy is accessible
- Ensure OAuth callback route (`/oauth-callback`) works
- Test redirect flow manually

#### Routing Issues (404 errors)
- Confirm `netlify.toml` is in root directory
- Check redirect rules are properly configured
- Verify React Router routes match URL patterns
- Test direct URL access to routes

#### Performance Issues
- Enable Gzip compression (automatic on Netlify)
- Check bundle size with `npm run build`
- Monitor Core Web Vitals in browser dev tools
- Consider code splitting for large components

## 📊 Monitoring & Maintenance

### Netlify Analytics
- Enable in Site Settings → Analytics
- Monitor traffic, performance, and errors
- Set up alerts for build failures

### Build Notifications
Configure in Site Settings → Build & deploy → Deploy notifications:
- Email notifications for failed builds
- Slack integration for team updates
- GitHub status checks

### Regular Maintenance
- [ ] Monitor build times (should be < 5 minutes)
- [ ] Check dependency updates monthly
- [ ] Review security headers quarterly
- [ ] Test OAuth flow after any QBO API changes
- [ ] Backup environment variable configuration

## 🔗 Useful Links
- [Netlify Documentation](https://docs.netlify.com/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#netlify)
- [React Router Deployment](https://reactrouter.com/web/guides/deployment)
- [Clerk Deployment](https://clerk.com/docs/deployments/overview)

## 📞 Support
If you encounter issues not covered in this guide:
1. Check Netlify build logs first
2. Review browser console for client-side errors
3. Verify all environment variables are correctly set
4. Test the build process locally before debugging on Netlify

---
*Last updated: 2025-01-06*
*Configuration version: 1.0*