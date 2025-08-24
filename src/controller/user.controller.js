import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refreah and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user detail from frontend
  //   validation - not empty
  //  check if user already exists : username, email
  //  check for images, check for avatar
  // upload them to cloudinary, avatar successfully uploaded or not
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  const { fullName, email, username, password } = req.body;

  // console.log("request body",req.body)

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All field are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
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
  console.log("avatar upload result: ", avatar);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  console.log("coverImage upload result: ", coverImage);

  if (!avatar) {
    throw new ApiError(400, "Error while uploading avatar file");
  }
  // if(!coverImage){
  //     throw new ApiError(400, "CoverImage file is required")
  // }

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
    throw new ApiError(500, "User registration failed. Please try again.");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User register successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // First get data from user to through using POST method /Frontend Login page
  // email/username and also password with use verify
  // Server check these are data alrady existed in dataBase and then verify user relogin for send data username/email and password these are matched
  // then create a new refresh token and this token store in your browser of http-only cookie / localStorage/sessionStorage
  // when created refresh token with use access any authantication page do you access
  // when you logout then refresh token delete from your browser of http-only cookie / localStorage/sessionStorage
  // --------------------------------------------------------------------------------
  // req.body -> data
  // username or email
  // find the user
  // password check
  // access and refresh token
  // send cookie

  const { email, username, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }
  // if (!(username || email)) {
  //   throw new ApiError(400, "username or email is required");
  // }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials (password)");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

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
        "User LoggedIn Successfully"
      )
    );
});
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
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
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }
  try {
    const decoedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = User.findById(decoedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "refreh token is expired or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("refreshToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "Access token refreshed successfully"
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confPassword } = req.body;
  // if(!(newPassword === confPassword)){

  // }

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Old password is incorrect");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse (200, req.user, "Current user details fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError(400, "Full name and email are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User details updated successfully"));
});

// const updateUserAvatar = asyncHandler(async (req, res) => {
  

//   const avatarLocalPath = req.file?.path;
//   if (!avatarLocalPath) {
//     throw new ApiError(400, "Avatar file is required");
//   }

//   const avatar = await uploadOnCloudinary(avatarLocalPath);
//   if(!avatar.url){
//     throw new ApiError(400, "Error while uploading on avatar")
//   }

//     const user = await User.findByIdAndUpdate(
//     req.user?._id,
//     {
//       $set:{
//         avatar: avatar.url
//       }
//     },
//     {new : true}
//   ).select("-password");
//  return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));

// });


const updateUserAvatar = asyncHandler(async (req, res) => {

  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }
  const user = await User.findById(req.user?._id);
  if(!user){
    throw new ApiError(404, "User not found");
  }

  const oldAvatarId = user.avatar?.public_id;

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if(!avatar.url){
    throw new ApiError(400, "Error while uploading on avatar")
  }

    user.avatar = {
      public_id: avatar.public_id,
      url: avatar.url
    };
    await user.save();
    if(oldAvatarId){
      await cloudinary.uploader.destroy(oldAvatarId);
    }
 return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));

});


// const updateUserCoverImage = asyncHandler(async (req, res) => {
//   const coverImageLocalPath = req.file?.path;
//   if (!coverImageLocalPath) {
//     throw new ApiError(400, "Cover Image file is missing");
//   }

//   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

//   if (!coverImage.url) {
//     throw new ApiError(400, "Error while uploading cover image file");
//   }
//   const user = await User.findByIdAndUpdate(
//     req.user?._id,
//     {
//       $set: {
//         coverImage: coverImage.url,
//       },
//     },
//     { new: true }
//   ).select("-password");
//   return res.status(200).json(new ApiResponse(200, user, "Cover image updated successfully"));
// });


const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file is missing");
  }

 const user = await User.findById(req.user?._id);
 if(!user){
  throw new ApiError(404, "User not found");
 }

 const oldCoverImageId = user.coverImage?.public_id;
 const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading cover image file");
  }
  user.coverImage = {
    public_id: coverImage.public_id,
    url: coverImage.url
  }
  await user.save();
  if(oldCoverImageId){
    await cloudinary.uploader.destroy(oldCoverImageId);
  }
  return res.status(200).json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const {username} = req.params;
  if(!username?.trim()){
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match:{
        username: username.tolowerCase()

      }
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id", 
        foreignField:"channel",
        as:"subscribers"
      }
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id", 
        foreignField:"channel",
        as:"subscribedTo"
      }
    },
    {
      $addFields:{
        subscribersCount: {$size: "$subscribers"},
        channelSubscribedToCount: {$size: "$subscribedTo"},
        isSubscribed: {
          $in:[
            req.user?._id,
            "$subscribers.subscriber"
          ]
        },
        isSubscribed:{
          $cond:{
            if:{$in:[req.user?._id, "$subscribers.subscriber"]},
            then:true,
            else:false
          }
        }
      }
    },
    {
      $project:{
        fullName:1,
        username:1,
        subscribersCount:1,
        channelSubscribedToCount:1,
        isSubscribed:1,
        avatar:1,
        coverImage:1,
        email:1,
      }
    }
  ])

  if(!channel?.length){
    throw new ApiError(404, "Channel not found");
  }

  return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully"));
})

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match:{
        _id: new mongoose.Types.ObjectId(req.user?._id)
      }
    },
    {
      $lookup:{
        from:"videos",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",
        pipeline:[
          {
            $lookup:{
              from:"users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",
              pipeline:[
                {
                  $project:{
                    fullName:1,
                    username:1,
                    avatar:1,
                  }
                }
              ]
            }
          },
          {
            $addFields:{
              owner:{
                $first:"$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res.status(200).json(new ApiResponse(200, user[0]?.watchHistory || [], "User watch history fetched successfully"));  
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
  getUserChannelProfile,
  getWatchHistory
};
