import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

export const requireActiveUser = async (req, res, next) => {
  try {
    const db = getDB();

    const user = await db.collection("user").findOne(
      { _id: new ObjectId(req.user.id) },
      { projection: { isBlocked: 1 } }
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (user.isBlocked === true) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
    }

    next();
  } catch (error) {
    console.error("Active user verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify account status.",
    });
  }
};