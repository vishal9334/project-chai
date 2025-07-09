import { Router } from "express";
import { upload } from "../middleware/multer.middleware.js";
import {
  loginUser,
  registerUser,
  logoutUser,
} from "../controller/user.controller.js";
import { verifyJWT } from "../middleware/auth.middelware.js";

const router = Router();
router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

// secure route

router.route("/logout").post(verifyJWT, logoutUser);

export default router;
