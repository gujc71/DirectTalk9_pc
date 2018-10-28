import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import dateFormat from 'dateformat';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import AttachFileIcon from  '@material-ui/icons/AttachFile';
import ImageIcon from  '@material-ui/icons/Image';
import Fade from '@material-ui/core/Fade';
import CircularProgress from "@material-ui/core/CircularProgress";

import styles from './styles4List';

import ChatItemLeft from './ChatItemLeft';
import ChatItemRight from './ChatItemRight';
import imageTool from './ImageTool';
import {firestore, storage} from '../../reducer/Firestore';
import {dialog_set} from '../../reducer/App_reducer';

class ChattingWindow extends React.Component {

  state = {
    chattings:[],
    selectedRoom: {},
	  fileUploading: false,
	  progressCompleted: 0
  }

  componentWillMount () {
    const param = this.props.room;
    if (param.roomid)                      // param = room (else param=user)
         this.firebase_chat_list (param);
    else this.firebase_find_chatroom (param);
  }
  componentWillUnmount (){
    if (this.chatlistener) this.chatlistener();       // release
  }

  componentDidUpdate() {
    if (this.listview) {
      this.listview.scrollTop = this.listview.scrollHeight;
    }
  }

  firebase_chat_list = (roomInfo) =>{
    const uid = this.props.uid;
    let users= this.props.users;
    let roomuserInfos = {};
    let roomusers = Object.keys(roomInfo.users);
    const roomusercnt = roomusers.length;

    roomusers.map(row => {
      let inx = users.findIndex(user => user.uid === row);
      if (inx >-1) {
        roomuserInfos[row] = {};
        roomuserInfos[row]["usernm"] = users[inx].usernm;
        roomuserInfos[row]["photourl"] = users[inx].photourl;
      }
      return row;
    })
    users = null;
    roomusers = null;
    
    this.setState({ selectedRoom: roomInfo });

    // read all my msg in a room
    roomInfo.users[uid] = 0;
    firestore.collection('rooms').doc(roomInfo.roomid).update({users: roomInfo.users});  

    function cleaningchattingdata (row) {
      if (Number.isInteger(row.timestamp)) {                    // it's temp because can't use serverTimestamp
        row.time = dateFormat(row.timestamp, "TT hh:MM")
        row.date = dateFormat(row.timestamp, "yyyy-mm-dd")
      } else {
        row.time = dateFormat(row.timestamp.toDate(), "TT hh:MM");
        row.date = dateFormat(row.timestamp.toDate(), "yyyy-mm-dd");
      }
      row.unreadcount = roomusercnt - row.readUsers.length;
      row.userInfo = roomuserInfos[row.uid];
      return row;
    }

    let ref = firestore.collection("rooms").doc(roomInfo.roomid).collection("messages");
    const _this = this;
    this.chatlistener=ref.orderBy("timestamp")
            .onSnapshot(function(snapshot) {
                var newlist = [];
                snapshot.docChanges().forEach(function(change) {
                    var row = change.doc.data();
                    row.chatid= change.doc.id;

                    if (change.type === "added") {
                        if (row.readUsers.indexOf(uid) === -1) {
                          row.readUsers.push(uid);
                          ref.doc(change.doc.id).update("readUsers", row.readUsers);  // send read
                        }
                        newlist.push(cleaningchattingdata (row));
                    } else
                    if (change.type === "modified") {
                      row = cleaningchattingdata (row);
                      let chattings = _this.state.chattings;
                      let inx = chattings.findIndex(chat => chat.chatid === row.chatid);
                      if (inx>-1) {                                    
                        _this.setState({ chattings: chattings.map(chat => chat.chatid === row.chatid ? {...row }: chat) });                 
                      }                        
                    } 
                });
                if (newlist.length>0){
                  _this.setState({chattings: _this.state.chattings.concat(newlist)});
                }
            });
    this.props.dispatch(dialog_set({roomid: roomInfo.roomid, chatlistener: this.chatlistener}));
  }

  firebase_chat_save = (data) => {
    const uid = this.props.uid;
    const selectedRoom = this.state.selectedRoom;
    data.timestamp = Date.now();                                                    // it's temp because can't use serverTimestamp

    const ref = firestore.collection('rooms').doc(selectedRoom.roomid);
    ref.collection("messages").add(data);

    ref.get().then(function(doc) {
      let room = doc.data(); 
      let roomusers = room.users;
      for(var inx in roomusers) {
        if (inx!==uid) roomusers[inx]++;
      }

      ref.update({msg:data.msg, msgtype:data.msgtype, timestamp:data.timestamp, uid: uid, users: roomusers});
    })        
  }

  firebase_rooms_save = ( roomdata, chatdata) => {
    if (!roomdata.roomid) {       // make chatting room before send msg
      var title = roomdata.title;
      roomdata.title = null;
      roomdata.msg = chatdata.msg;            // last message
      roomdata.msgtype = chatdata.msgtype;
      roomdata.timestamp = Date.now();                // it's temp because can't use serverTimestamp

      var doc = firestore.collection('rooms').doc();
      doc.set(roomdata);

      roomdata.title = title;
      roomdata.roomid = doc.id;

      this.firebase_chat_list(roomdata);
      this.firebase_chat_save(chatdata);
    } else {
        firestore.collection('rooms').doc(roomdata.uid).update(roomdata);    
    }
  }

  firebase_find_chatroom = (toUser) => {
    const uid = this.props.uid;
    const rooms = this.props.rooms;
    
    const chattingroom = rooms.find(row => {
      let roomusers = Object.keys(row.users);
      return roomusers.length===2 & roomusers.indexOf(toUser.uid)>-1 & roomusers.indexOf(uid)>-1;
    });

    if (chattingroom) {
      chattingroom.title = toUser.usernm;
      this.firebase_chat_list(chattingroom);
    } else {                                        // make chatting room
      let makeRoomdata = {
        title: toUser.usernm,
        users: {}
      }
      makeRoomdata.users[toUser.uid] = 0;
      makeRoomdata.users[uid] = 0;        
      this.setState({ selectedRoom: makeRoomdata });
    }
  };

  handleSendMsg = () => {
    if (this.inputMsg.value.trim().length===0) {
      alert("input your message.");
      return;
    }
    this.realSendMsg("0", this.inputMsg.value);     // 0 = text
    this.inputMsg.value = "";
    this.inputMsg.focus();
  };

  realSendMsg = (type, message, fileinfo) => {
    let data = {
      msg: message,
      msgtype: type,
      uid: this.props.uid,
      readUsers: [this.props.uid]
    }
    if (fileinfo) {
      data["filename"] = fileinfo.filename;
      if (fileinfo.filesize) data["filesize"] = fileinfo.filesize;
    }

    if (this.state.selectedRoom.roomid) {
      this.firebase_chat_save(data);
    } else {
      this.firebase_rooms_save(this.state.selectedRoom, data);
    }
  };
  
  progress = () => {
    const { progressCompleted } = this.state;
    this.setState({ progressCompleted: progressCompleted >= 100 ? 0 : progressCompleted + 1 });
  };

  handleAddImage = () => {
    this.timer = setInterval(this.progress, 20);  
    this.setState({fileUploading: true});	

    const file = this.imagefile.files[0];

    var newname = this.getNewName();
    var filename = this.getFileName(file.name);
    const _this = this;
	
    var reader = new FileReader();
	reader.onloadend = function (evt) {
      var blob = new Blob([evt.target.result]);
      storage.child("files/"+ newname).put(blob).then(function(snapshot ) {
        clearInterval(_this.timer);
		_this.setState({fileUploading: false});	
	  })
    }
    reader.readAsArrayBuffer(file);
  
    imageTool(file, (imageurl) =>  {
      const inx = imageurl.indexOf(";base64,");         // data:image/jpeg;base64,
      if (inx>0) imageurl = imageurl.substring( inx+8, imageurl.length);

      storage.child("filesmall/"+newname).putString(imageurl, "base64").then(function(snapshot ) {
        _this.realSendMsg("1", newname, {"filename":filename});     // 1 = image
      });
    });
  }

  handleAttachFile = () => {
    this.timer = setInterval(this.progress, 20);  
    this.setState({fileUploading: true});	
	
    const file = this.attachfile.files[0];

    var newname = this.getNewName();
    var filename = this.getFileName(file.name);

    const _this = this;

    var reader = new FileReader();
	reader.onloadend = function (evt) {
      var blob = new Blob([evt.target.result]);//, { type: "image/jpeg" });
      storage.child("files/"+ newname).put(blob).then(function(snapshot ) {
        clearInterval(_this.timer);
		_this.setState({fileUploading: false});	
        _this.realSendMsg("2", newname, {"filename":filename, "filesize": _this.size2String(file.size) });     // 2 = file
      });
    }
    reader.readAsArrayBuffer(file);
	
  }

  getNewName = () => {
    return  dateFormat(new Date(), "yyyymmddHHMMssl") + Math.floor((Math.random() * 10) + 1);
  }
  getFileName = (path) => {
    return path.substring(path.lastIndexOf("/")+1);
  }
  size2String = (filesize) => {
    const UNIT = 1024;
    if (filesize < UNIT){
        return filesize + " bytes";
    }
    let exp = Math.floor(Math.log(filesize) / Math.log(UNIT));

    return Math.floor(filesize / Math.pow(UNIT, exp)) + "KMGTPE".charAt(exp-1) + "bytes";
  }

  render() {
    const { classes, uid} = this.props;
    const { chattings, selectedRoom, fileUploading} = this.state;
    
    return (
      <div> 
          <h2>{selectedRoom.title}</h2>
          <ul className="chat-list" ref={(node) => this.listview = node}>
            {
              chattings.map((row, inx) => 
                uid===row.uid
                ? <ChatItemRight key={inx} item={row} beforeItem={chattings[inx-1]}/>
                : <ChatItemLeft key={inx} item={row}  beforeItem={chattings[inx-1]}/>
              )
            }          
          </ul>  
        <div className="chat-footer">  
          <TextField inputRef={(node) => this.inputMsg = node} multiline rows="2" margin="normal" variant="outlined" style={{float:"left", marginTop: "0px", width: "78%"}}/> 
          <div style={{float:"left", width: "16%", marginLeft: "10px"}}>
            <Button onClick={this.handleSendMsg} variant="outlined">Send</Button>
            <Fade in={fileUploading}>			
			  <CircularProgress className="chat-progress" variant="determinate" size={50} value={this.state.progressCompleted} />		  
			</Fade>  
            <div >
              <input ref={(node) => this.imagefile = node} accept="image/*" className={classes.input} style={{ display: 'none' }}  id="imagefile"  type="file" onChange={this.handleAddImage}/>
              <label htmlFor="imagefile" style={{cursor:"pointer"}}><ImageIcon fontSize="small"/></label>
              <input ref={(node) => this.attachfile = node} accept="*" className={classes.input} style={{ display: 'none' }}  id="attachfile"  type="file" onChange={this.handleAttachFile}/>
              <label htmlFor="attachfile" style={{cursor:"pointer"}}><AttachFileIcon fontSize="small"/></label>
            </div>
          </div>
        </div>  
      </div>  
    );
  }
}

ChattingWindow.propTypes = {
  classes: PropTypes.object.isRequired,
};

let mapStateToProps = (state) => {
  return {
    uid: state.uid,
    users: state.users,
    rooms: state.rooms,
    chattings: state.chattings
  };
}

export default connect(mapStateToProps)(withStyles(styles)(ChattingWindow));
