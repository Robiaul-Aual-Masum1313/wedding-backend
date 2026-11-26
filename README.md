# WedPlan – Backend API

This repository contains the backend API for **WedPlan**, a wedding planning platform that connects customers with wedding service providers.

The backend is built with Node.js and Express.js and uses MongoDB for data storage. It handles authentication, authorization, service management, booking operations, vendor subscriptions, and administrative functionality.

## 🌐 Project Links

- **Live Website:** [WedPlan](https://wedding-frontend-murex.vercel.app/)
- **Frontend Repository:** [WedPlan Frontend](https://github.com/Robiaul-Aual-Masum1313/wedding-frontend)
- **Backend Repository:** [WedPlan Backend](https://github.com/Robiaul-Aual-Masum1313/wedding-backend)

## ✨ Key Features

- **Authentication:** Secure user authentication using Better Auth, including email/password and Google OAuth.
- **JWT Authorization:** Token-based authentication for protecting backend API endpoints.
- **Role-Based Access Control:** Separate permissions for Customers, Vendors, and Administrators.
- **User Management:** Admin functionality for viewing, searching, filtering, blocking, and unblocking users.
- **Service Management:** Vendors can create, update, delete, and manage their wedding services.
- **Service Approval:** Administrators can approve or reject vendor service listings.
- **Booking Management:** Customers can create and manage bookings, while vendors can accept or reject booking requests.
- **Customer Profile Management:** Customers can retrieve and update their profile information.
- **Vendor Profile Management:** Vendors can manage their personal and business information.
- **Subscription Management:** Vendors can purchase the Premium subscription using Stripe Checkout.
- **Stripe Webhooks:** Verify successful subscription payments and update subscription information in MongoDB.
- **Transaction Management:** Store successful payment transactions and provide transaction information for administrators.
- **Image Upload:** Upload service and profile images using the ImgBB API.
- **Protected APIs:** Authentication and role-based middleware protect private resources.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Backend framework |
| MongoDB | Database |
| Better Auth | Authentication |
| JWT | API authorization |
| Stripe | Subscription payments |
| ImgBB API | Image hosting |
| CORS | Cross-origin resource sharing |
| dotenv | Environment variable management |

## 📦 Installation Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Robiaul-Aual-Masum1313/wedding-backend.git
```

### 2. Navigate to the Project Directory

```bash
cd wedding-backend
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000

CLIENT_URL=http://localhost:3000

MONGODB_URI=mongodb://127.0.0.1:27017
DB_NAME=wedplan

BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_SECRET=your_secure_better_auth_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

IMGBB_API_KEY=your_imgbb_api_key

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PREMIUM_PRICE_ID=your_stripe_price_id
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

**Important:**

- Replace the placeholder values with your own credentials.
- Configure Google OAuth credentials in the Google Cloud Console.
- Create a Stripe product and recurring price, then use its Price ID.
- Configure a Stripe webhook endpoint pointing to `/api/stripe/webhook`.
- Never commit your `.env` file or expose private API keys in the frontend.

### 5. Run the Backend Server

For development:

```bash
npm run dev
```

If your project does not have a development script, use:

```bash
npm start
```

The backend API should now be available at:

```text
http://localhost:5000
```

## 🔌 API Overview

The backend provides API endpoints for the following modules:

| Module | Responsibility |
|---|---|
| Authentication | Registration, login, Google OAuth, and session authentication |
| Services | Public service browsing and vendor service management |
| Customer | Customer profile and dashboard functionality |
| Vendor | Vendor dashboard, profile, and subscription functionality |
| Bookings | Booking creation and booking management |
| Admin | User management, service approval, and transactions |
| Uploads | Image upload functionality |
| Stripe | Subscription checkout and payment webhook processing |

## 🚀 Production Deployment

The backend is deployed on Vercel.

**Backend URL:**

https://wedding-backend-eosin.vercel.app/

For production deployment:

1. Configure all required environment variables in Vercel.
2. Update `CLIENT_URL` to the deployed frontend URL.
3. Configure the production Better Auth URL.
4. Add the production Stripe webhook endpoint.
5. Set the production Stripe webhook signing secret.
6. Redeploy the backend after updating environment variables.

## 🔗 Project Repositories

- **Frontend Repository:** [WedPlan Frontend](https://github.com/Robiaul-Aual-Masum1313/wedding-frontend)
- **Backend Repository:** [WedPlan Backend](https://github.com/Robiaul-Aual-Masum1313/wedding-backend)

## 👨‍💻 Project Information

**Project Name:** WedPlan – Wedding Planning Platform

**Backend Framework:** Node.js and Express.js

**Database:** MongoDB

**Live Website:** https://wedding-frontend-murex.vercel.app/

