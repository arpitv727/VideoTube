import mongoose, { Schema } from "mongoose";


const subscriptionSchema = new Schema({

    subscriber: {
        type: Schema.Types.ObjectId, // ading user id , one who is subscribing
        ref: "User"

    },
    channel: {
        type: Schema.Types.ObjectId, // ading user id , one whose channel is subscribed
        ref: "User"
    }

},{timestamps:true})



export const Subscription = mongoose.model("Subscription", subscriptionSchema)
