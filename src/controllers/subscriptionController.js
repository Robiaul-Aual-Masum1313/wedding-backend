
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { getStripe } from "../config/stripe.js";

export const createCheckoutSession = async (req, res) => {
  try {
    const { id } = req.user;

    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    const clientURL = process.env.CLIENT_URL?.replace(/\/$/, "");

    if (!priceId || !clientURL) {
      return res.status(500).json({
        success: false,
        message: "Stripe configuration is incomplete.",
      });
    }

    // Find the authenticated vendor in MongoDB.
    const userIdConditions = [
      { id },
      { _id: id },
    ];

    if (ObjectId.isValid(id)) {
      userIdConditions.push({
        _id: new ObjectId(id),
      });
    }

    const vendor = await getDB()
      .collection("user")
      .findOne({
        $or: userIdConditions,
      });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor account not found.",
      });
    }

    // Prevent an already active Premium vendor
    // from purchasing the same subscription again.
    const subscriptionExpiry = vendor.subscriptionExpiresAt
      ? new Date(vendor.subscriptionExpiresAt)
      : null;

    const hasActivePremium =
      vendor.subscriptionPlan === "Premium" &&
      (!subscriptionExpiry ||
        subscriptionExpiry.getTime() > Date.now());

    if (hasActivePremium) {
      return res.status(409).json({
        success: false,
        message: "You already have an active Premium subscription.",
      });
    }

    const stripe = getStripe();

    // Create Stripe Checkout Session.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      customer_email: vendor.email,

      client_reference_id: String(vendor.id ?? vendor._id),

      metadata: {
        vendorId: String(vendor.id ?? vendor._id),
        plan: "Premium",
      },

      subscription_data: {
        metadata: {
          vendorId: String(vendor.id ?? vendor._id),
          plan: "Premium",
        },
      },

      success_url:
        `${clientURL}/dashboard/vendor/subscription` +
        "?checkout=success&session_id={CHECKOUT_SESSION_ID}",

      cancel_url:
        `${clientURL}/dashboard/vendor/subscription?checkout=cancelled`,
    });

    if (!session.url) {
      throw new Error("Stripe Checkout URL was not generated.");
    }

    return res.status(200).json({
      success: true,
      message: "Checkout session created successfully.",
      url: session.url,
    });
  } catch (error) {
    console.error("Create checkout session error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create checkout session.",
    });
  }
};
