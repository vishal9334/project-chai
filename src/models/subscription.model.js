import mongoose, {Schema} from "mongoose"

const subsscriptionSchema = new Schema({
    subscriber:{
        type: Schema.Types.ObjectId, //one who is subscribing
        ref: "User",
    },

    channel:{
        type: Schema.Types.ObjectId, // one to whom 'subscriber' is subscribing
        ref: "User",
    }
},{timeseries:true})

export const SubScription = mongoose.model("Subscription", subsscriptionSchema)