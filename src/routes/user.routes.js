import { Router } from "express";
import{upload} from "../middleware/multer.middleware.js"
import { loginUser, registerUser } from "../controller/user.controller.js";

const router = Router();
router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)

// secure route

router.route("/logout").post(verifyJWT, ogoutUser)

export default router