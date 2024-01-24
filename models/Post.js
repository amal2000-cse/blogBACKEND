const mongoose = require('mongoose');
const {Schema,model}=mongoose;

const PostSchema=new Schema({
    title:String,
    summary:String,
    content:String,
    cover:String,
    //getting the author details from the user schema
    author:{type:Schema.Types.ObjectId,ref:'User'},
    },
    {
     //we are also adding timestamps
     timestamps:true,
})

const PostModel=model('Post',PostSchema);
module.exports=PostModel;