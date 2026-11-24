
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { getStripe } from "../config/stripe.js";

export const handleStripeWebhook = async (req, res) => {
  const stripe = getStripe();

  let event;

  // 1. Verify that this request genuinely came from Stripe.
  try {
    const signature = req.headers["stripe-signature"];

    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error.message);

    return res.status(400).send("Invalid Stripe signature.");
  }

  try {
    // 2. Handle successful Checkout completion.
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Only process our Premium subscription checkouts.
      if (
        session.mode !== "subscription" ||
        session.metadata?.plan !== "Premium"
      ) {
        return res.status(200).json({ received: true });
      }

      // A completed redirect does not necessarily mean payment succeeded.
      if (session.payment_status !== "paid") {
        return res.status(200).json({ received: true });
      }

      const vendorId = session.metadata?.vendorId;
      const subscriptionId = session.subscription;

      if (!vendorId || !subscriptionId) {
        throw new Error("Vendor ID or subscription ID is missing.");
      }

      // 3. Retrieve the subscription directly from Stripe.
      const subscription = await stripe.subscriptions.retrieve(
        subscriptionId
      );

      if (
        subscription.status !== "active" &&
        subscription.status !== "trialing"
      ) {
        throw new Error("Stripe subscription is not active.");
      }

      // 4. Find the vendor in MongoDB.
      const userIdConditions = [
        { id: vendorId },
        { _id: vendorId },
      ];

      if (ObjectId.isValid(vendorId)) {
        userIdConditions.push({
          _id: new ObjectId(vendorId),
        });
      }

      const usersCollection = getDB().collection("user");

      const vendor = await usersCollection.findOne({
        $or: userIdConditions,
        role: "Vendor",
      });

      if (!vendor) {
        throw new Error("Vendor account not found.");
      }

      // 5. Save the transaction only once per Checkout Session.
      const transactionsCollection = getDB().collection("transactions");

      const existingTransaction = await transactionsCollection.findOne({
        stripeSessionId: session.id,
      });

      if (!existingTransaction) {
        await transactionsCollection.insertOne({
          vendorId,
          plan: "Premium",
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || "usd",
          stripeSessionId: session.id,
          stripeSubscriptionId: subscription.id,
          status: "Paid",
          createdAt: new Date(),
        });
      }

      // 6. Activate Premium using the verified subscription expiry.
const subscriptionItem = subscription.items.data[0];

const expiryTimestamp = subscriptionItem?.current_period_end;

if (!expiryTimestamp) {
  throw new Error("Subscription expiry date is missing.");
}

      await usersCollection.updateOne(
        { _id: vendor._id },
        {
          $set: {
            subscriptionPlan: "Premium",
            subscriptionExpiresAt: new Date(
              expiryTimestamp * 1000
            ),
            updatedAt: new Date(),
          },
        }
      );
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);

    // Stripe can retry the event when it receives a server error.
    return res.status(500).json({
      success: false,
      message: "Unable to process Stripe webhook.",
    });
  }
};
