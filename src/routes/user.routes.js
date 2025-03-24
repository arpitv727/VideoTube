import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getChannelProfile, getWatchHistory } from "../controllers/user.controllers.js";
import { upload } from "../middelwares/multer.middelware.js"
import { verifyJWT } from "../middelwares/auth.middelware.js"


const router = Router();

router.route("/register").post(


    // using multer to upload on cloudnary
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1,
        },

    ]),

    registerUser)

router.route("/login").post(loginUser)

//secured routes

router.route("/logOut").post(verifyJWT, logoutUser)

router.route("/refresh-token").post(refreshAccessToken)

router.route("/change-password").post(verifyJWT, changeCurrentPassword)

router.route("/current-user").get(verifyJWT, getCurrentUser)

router.route("/update-account").patch(verifyJWT, updateAccountDetails)

router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)

router.route("/cover-image").patch(verifyJWT, upload.single("coverImage", updateUserCoverImage))

router.route("/c/:username").get(verifyJWT, getChannelProfile)

router.route("/history").get(verifyJWT, getWatchHistory)
export default router;