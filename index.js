const express = require('express')
const cors=require('cors');
const mongoose = require('mongoose');
const User=require('./models/User')
const bcrypt=require('bcrypt')
const jwt=require('jsonwebtoken')
const cookieParser=require('cookie-parser')
const multer=require('multer');
const Post=require('./models/Post')
require('dotenv').config()

//now to rename the file we will use the library fs
const fs =require('fs')

//for uploading file intot the uploads folder
const uploadMiddleware = multer({ dest: 'uploads/' })


const app=express();

//salt is for bcrypt
const saltRounds = 10;
//secret for jsonweb tokens
const secret=process.env.secret


//if we are addin the token inside a cookie,and if we use use credentials:'include' in the front end
//then inside the cors() we have to add -credentials:true, and origin
app.use(cors({credentials:true,origin:'http://localhost:3000'}))

//to get the json from the req.body
app.use(express.json());

//adding middleware for cookie parser
//after using this we will be able to read cookies
app.use(cookieParser());

//to share all the static files from the uploads folder to the frontend
//app.use(express.static('uploads'));
app.use('/uploads',express.static(__dirname+'/uploads'));


//connecting with the mongodb database
const mongoURL=process.env.mongoURL
 mongoose.connect(mongoURL)


app.post('/register',async(req,res)=>{
    const {username ,password}=req.body;
    //now this will return us the user document
    //if the username is not unique then it will show a error
    //so we use try catch to catch the error
    try {
        const salt = bcrypt.genSaltSync(saltRounds);
        const userDoc=await User.create({username,password:bcrypt.hashSync(password, salt)})
       
        res.json(userDoc)

    } catch (error) {
        console.log(error)
        res.status(400).json(error)
    }

})

app.post('/login',async(req,res)=>{
    const{username,password}=req.body;
        const userDoc=await User.findOne({username:username});

        if (!userDoc) {
            // User not found in the database
            return res.status(400).json('User not found');
        }

        const passOk=bcrypt.compareSync(password,userDoc.password);

        if(passOk){
            //user logged in
            //if the user is logged in we will send a token
            jwt.sign({
                username,id:userDoc._id
            }, secret, {},(err,token)=>{
                if (err) throw err;
                //now we will be sending the token to the cookie
                res.cookie('token',token).json({
                    id:userDoc._id,
                    username,
                });
            });
        }
        else{
            //not logged in
            res.status(400).json('Wrong Credentials');
        }
        // res.json(passOk)
  
})

//checking if the token is valid or not
app.get('/profile',(req,res)=>{
    //for this to work we need to add a middleware with a cookie parser
    //with the help of the middleware cookie-parser we will be able to read the cookie
    //app.use(cookieParser()) - this is mentioned at the top
    const {token}=req.cookies;
    //now we are verifying the token
    jwt.verify(token,secret,{},(err,info)=>{
        if(err) throw err;
        res.json(info)
    })
    //  res.json(req.cookies)
})


//FOR logout
app.post('/logout',(req,res)=>{
    res.cookie('token','', { expires: new Date(0) }).json('ok')
})

app.post('/post',uploadMiddleware.single('file'),async (req,res)=>{
    //we are changing the names of the files saved in the uploads folder
    const {originalname,path}=req.file;
    //here we are splitting where there is a '.' in the image file name
    const parts = originalname.split('.')
    //and the part that is at the right side of the '.' will be the extension name of the file
    const ext = parts[parts.length-1]
    //now renameing the file name
    const newPath=path+'.'+ext
    fs.renameSync(path,newPath);

    //now getting the user id from the cookie
    const {token}=req.cookies;
    //now we are verifying the token
    //now inside the info we will have the author id
    jwt.verify(token,secret,{},async(err,info)=>{
        if(err) throw err;

        //when the user is verified we are adding all the details to the database
        const{title,summary,content}=req.body;

        //now uploading the post to the mongodb database
        //now this will return us the post document from the database

        const postDoc=await Post.create({
            title,
            summary,
            content,
            cover:newPath,
            author:info.id,
        })
        res.json(postDoc);
        // res.json(info)

    })
})

//now to update the post by id - we use PUT
app.put('/post',uploadMiddleware.single('file'),async(req,res)=>{
    let newPath=null;

     // Check if a file is uploaded
     if (!req.file) {
        return res.status(400).json('No file uploaded');
    }

    if(req.file){
        const {originalname,path}=req.file;
        const parts = originalname.split('.')
        const ext = parts[parts.length-1]
        newPath=path+'.'+ext
        fs.renameSync(path,newPath);

    }

    const {token}=req.cookies;
    jwt.verify(token,secret,{},async(err,info)=>{
        if(err) throw err;

        const{id,title,summary,content}=req.body;

        const postDoc=await Post.findById(id);
        //for better comparison for both of these we will convert it using JSON.stringify
        const isAuthor=JSON.stringify(postDoc.author)===JSON.stringify(info.id)
        if(!isAuthor){
           return res.status(400).json('you are not the author')
        }

        //if we are the author
        await postDoc.updateOne({
            title,
            summary,
            content,
            // if new path is present then we will provide the new path
            // otherwise we will update the older path
            cover:newPath ? newPath : postDoc.cover,
        })
        res.json(postDoc)
    })
})

//now adding a get request for all the posts from the page IndexPage.js file inside the client
app.get('/post',async(req,res)=>{
    //now as we have already linked the collections using author we can also populate them
    const posts = await Post.find()
                            .populate('author',['username'])
                            //to reverse the order of the posts we are sorting it
                            .sort({createdAt:-1})
                            //now limiting the post ot 20
                            .limit(20)
    res.json(posts)

})

//sending data for particular post
app.get('/post/:id',async(req,res)=>{
    const {id}=req.params;
                      // we will also populate the author details also
    const postDoc=await Post.findById(id).populate('author',['username'])
   res.json(postDoc)
})

console.log('server on 4000')
app.listen(4000);

//mongodb+srv://amal:suvarnam123@cluster0.7u6m64b.mongodb.net/?retryWrites=true&w=majority