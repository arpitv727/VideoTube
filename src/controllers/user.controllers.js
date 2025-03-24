import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudninary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// refresh and axcess token-----
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    user.save({ validateBeforeSave: false });

    return { refreshToken, accessToken };
  } catch (error) {
    throw new ApiError(
      500,
      " Something went wrong while generating fefresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  const { fullName, email, username, password } = req.body;
  //console.log("email: ", email);

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  //console.log(req.files);

  const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

// login user -------------------

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email login
  // find user registered or not
  // check password
  // access token and refresh token

  // send cookies -----

  // taking data from req.body
  const { email, username, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "username or email  is required");
  }

  // to match username or email form data base ---
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // check password is correct or not using bcrypt----using this method from user.model.js

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Incorrect Password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // sendng cookies ------
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in Successfully"
      )
    );
});

//logout user ------------------

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this means it will reset the fild from document
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

// refresh access token

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorised request")
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET

    )

    const user = await User.findById(decodedToken?._id)

    if (!user) {

      throw new ApiError(401, "Invalid refresh token")
    }

    if (incomingRefreshToken !== user?.refreshToken) {

      throw new ApiError(401, "Refresh token is expired or used")
    }

    // afterverigying every thing is alright generate new refresh token and access token
    const options = {

      httpOnly: true,
      secure: true,

    }

    const { newRefreshToken, accessToken } = await generateAccessAndRefreshToken(user._id)

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken }

        )

      )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")

  }

})


// to change current password -------------

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body


  const user = await User.findById(req.user?._id)

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if (!isPasswordCorrect) {

    throw new ApiError(400, "Invalid old Password")
  }

  user.password = newPassword

  await user.save({ validateBeforeSave: false })

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))

})

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))

})


const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body

  if (!fullName, !email) {

    throw new ApiError(400, "All fields are required")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {

        fullName, // ES6 syntax ---- fullName : fullName
        email: email,


      }

    },
    { new: true }

  ).select("-password")

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))

})


// update avtar ------------

const updateUserAvatar = asyncHandler(async (req, res) => {
  // files are accessed using multer
  const avatarLocalPath = req.file.path

  if (!avatarLocalPath) {

    throw new ApiError(400, "Avtar file is missing")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if (!avatar.url) {

    throw new ApiError(400, "Error while uploading avatar")
  }

  const user = await User.findByIdAndUpdate(

    req.user?._id,
    {

      $set: {

        avatar: avatar.url

      }

    },
    { new: true }
  ).select("- password")

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, "Avatar updated successfully")
    )

})

//update user cover image ----


const updateUserCoverImage = asyncHandler(async (req, res) => {

  const coverImageLocalPath = req.file.path

  if (!coverImageLocalPath) {

    throw new ApiError(400, " Cover Image file is missing")
  }

  const coverImage = uploadOnCloudinary(coverImageLocalPath)

  if (!coverImage) {

    throw new ApiError(400, "Error while uploading Cover Image")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,

    {
      $set: {

        coverImage: coverImage.url
      }

    },
    { new: true }


  ).select("-password")

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, " cover image updated successfully")
    )

})

// using aggrigation pipelines ---------

const getChannelProfile = asyncHandler(async (req, res) => {

  const { username } = req.params

  if (!username) {

    throw new ApiError(400, "username is missing")
  }

  const channel = await User.aggregate([

    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions", // to see from
        localField: "_id",  // see by taking refrence
        foreignField: "channel", // to see 
        as: "subscribers", // see as


      }
    },
    {
      $lookup: {
        from: "subscriptions", // to see from
        localField: "_id",  // see by taking refrence
        foreignField: "subscriber", // to see 
        as: "subscribedTo", // see as
      }
    },
    {
      $addFields: {
        subscriberCount: {

          $size: "$subscribers" // $ is aaded before because this is field now
        },
        channelSubscribedToCount: {
          $size: "subscribedTo"
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers"] },
            then: true,
            else: false,
          }

        }


      }

    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscriberCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,



      }
    }

  ])

  if (!channel?.length) {

    throw new ApiError(404, "channel does not exist")
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User Channel fetched successfully")
    )

})

const getWatchHistory = asyncHandler(async (req, res) => {

  const user = await User.aggregate([

    {

      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)


      }

    },
    {
      $lookup: {
        from: "videos", // all the letters are small and extra s is added because mongodb save model by adding s and all the letter in lowe case
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [

          {
            $lookup: {

              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [

                {

                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,

                  }
                },
                {
                  $addFields: {

                    owner: {

                      $first: "$owner"
                    }
                  }

                }
              ]
            }


          }
        ]

      }
    }


  ])
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "watch History fetched successfully"
      )
    )

})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getChannelProfile,
  getWatchHistory,
};
