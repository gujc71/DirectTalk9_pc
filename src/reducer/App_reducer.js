import { createAction, handleActions } from 'redux-actions';
import {firestore, firebaseAuth, storage} from './Firestore';
import dateFormat from 'dateformat';

// action type
const LOGIN = 'LOGIN';
const LOGOUT = 'LOGOUT';

const SNACKBAR = 'SNACKBAR';
const DIALOG_OPEN = 'DIALOGOPEN';
const DIALOG_CLOSE = 'DIALOGCLOSE';
const DIALOG_SET = 'DIALOGSET';

const USER_SAVE = 'USERSAVE';
const USER_REMOVE = 'USERREMOVE';
const USER_LIST = 'USERLIST'; 
const USER_ADDS = 'USERADDS';
const USER_ADDPHOTO = 'USERADDPHOTO';

const ROOMS_SAVE = 'ROOMSSAVE';
const ROOMS_REMOVE = 'ROOMSREMOVE';
const ROOMS_READ = 'ROOMSREAD';
const ROOMS_LIST = 'ROOMSLIST'; 
const ROOMS_ADDS = 'ROOMSADDS';

const UNREADCOUNT = 'UNREADCOUNT';

/*const CHAT_LIST = 'CHATLIST'; 
const CHAT_ADDS = 'CHATADDS';
const CHAT_INIT = 'CHATINIT';
const CHAT_SAVE = 'CHATSAVE';*/
// ----------------------------------------------------------------------------
export const login = createAction(LOGIN);
export const logout = createAction(LOGOUT);

export const show_snackbar = createAction(SNACKBAR);
export const dialog_open = createAction(DIALOG_OPEN);
export const dialog_close = createAction(DIALOG_CLOSE);
export const dialog_set = createAction(DIALOG_SET);

export const user_save = createAction(USER_SAVE);
export const user_remove = createAction(USER_REMOVE);
export const user_list = createAction(USER_LIST);
export const user_adds = createAction(USER_ADDS);
export const user_addphoto = createAction(USER_ADDPHOTO);

export const rooms_save = createAction(ROOMS_SAVE);
export const rooms_remove = createAction(ROOMS_REMOVE);
export const rooms_read = createAction(ROOMS_READ);
export const rooms_list = createAction(ROOMS_LIST);
export const rooms_adds = createAction(ROOMS_ADDS);

export const setUnreadcount = createAction(UNREADCOUNT);
/*
export const chat_list = createAction(CHAT_LIST);
export const chat_adds = createAction(CHAT_ADDS);
export const chat_init = createAction(CHAT_INIT);
export const chat_save = createAction(CHAT_SAVE);
*/
// ----------------------------------------------------------------------------
export const firebase_login = (email, pw) =>{
  return firebaseAuth.signInWithEmailAndPassword(email, pw);
}

export function firebase_logout () {
  return (dispatch) => {
    firebaseAuth.signOut();
    dispatch(logout());
  }  
}

export const firebase_register = (email, pw) =>{
  return firebaseAuth.createUserWithEmailAndPassword(email, pw).then(function() {
    var uid = firebaseAuth.currentUser.uid;

    var user = {
      uid: uid,
      userid: email,
      usernm: email,
      usermsg: ''
    };
    
    firestore.collection('users').doc(uid).set(user);
    login(uid);
  })
}
// =================================
export const firebase_user_list = () =>{
    return (dispatch) => {
        return firestore.collection("users").orderBy("usernm", "desc")
                .onSnapshot(function(snapshot) {
                    var newlist = [];
                    snapshot.docChanges().forEach(function(change) {
                        var row = change.doc.data();
                        if (change.type === "added") {
                            //row.uid = change.doc.id;
                            //console.log(row);
                            newlist.push(row);
                        } else
                        if (change.type === "modified") {
                            dispatch(user_save(row));
                        } else
                        if (change.type === "removed") {
                            dispatch(user_remove(row.uid));
                        }
                            
                    });
                    if (newlist.length>0) {
                      dispatch(user_adds(newlist));
                      newlist.map((user, inx) => {
                        if (user.userphoto) {
                            storage.child('userPhoto/'+user.userphoto).getDownloadURL()
                              .then(function(url) {
                                dispatch(user_addphoto({uid: user.uid, photourl:url}));
                              }).catch(function(error) {
                                console.log(error);
                              });
                        }
                        return user;      
                      });
                    }    
                });
    }
}

export const firebase_user_remove = ( uid) => {
    return (dispatch) => {
        return firestore.collection('users').doc(uid).delete();
    }
};

export const firebase_user_save = ( data) => {
    return (dispatch) => {
        if (!data.uid) {
            var doc = firestore.collection('users').doc();
            data.uid = doc.id;
            data.brddate = Date.now();
            return doc.set(data);
        } else {
            return firestore.collection('users').doc(data.uid).update(data);    
        }
    }
};
// =================================
export const firebase_rooms_list = () =>{
    return (dispatch, getState) => {
        const uid = getState().uid;
        let unreadcount = 0;

        function cleaningdata (row, acttype) {
          const roomusers = Object.keys(row.users);
          if (roomusers.length===2) {
              const inx = roomusers.find(user => user !== uid);
              if (inx){
                row.peer = inx;
              }
          } 
          if (row.msg !=null) { // there are last message
            if (Number.isInteger(row.timestamp)) {                    // it's temp because can't use serverTimestamp
              row.timestamp = dateFormat(row.timestamp, "yyyy-mm-dd")
            } else {
              row.timestamp = dateFormat(row.timestamp.toDate(), "yyyy-mm-dd")
            }

            switch(row.msgtype){
                case "1": row.msg = "Image"; break;
                case "2": row.msg = "File"; break;
                default:
            }
          }   

          const selectedRoom = getState().selectedRoom;
          if (getState().selectedRoom.roomid === row.roomid) {      // current chatting room
            //if (row.users[uid]>0) 
            unreadcount -= selectedRoom.count;
            row.users[uid] = 0;
            firestore.collection('rooms').doc(row.roomid).update({users: row.users});  // read all my msg in a room
          } else {
            acttype ? unreadcount ++ : unreadcount += row.users[uid];
          }
          row.count = row.users[uid];

          return row;
        }

        return firestore.collection("rooms").where("users."+uid,">=", 0) 
                .onSnapshot(function(snapshot) {
                    var newlist = [];
                    snapshot.docChanges().forEach(function(change) {
                        var row = change.doc.data();
                        row.roomid = change.doc.id;

                        if (change.type === "added") {
                          row = cleaningdata (row);
                          newlist.push(row);
                        } else
                        if (change.type === "modified") {
                          row = cleaningdata (row, "u");
                          dispatch(rooms_save(row));
                          dispatch(setUnreadcount(unreadcount));
                        } else
                        if (change.type === "removed") {
                          dispatch(rooms_remove(row.roomid));
                        }
                    });
                    if (newlist.length>0){
                      dispatch(rooms_adds(newlist));
                      dispatch(setUnreadcount(unreadcount));
                    }    
                });
    }
}


// ----------------------------------------------------------------------------

const initialState = {
  uid: null,
  //boards: [], 
  users: [],
  rooms: [],
  unreadcount: 0,
  //chattings: [],
  selectedRoom: {},
  chatWindows:[],

  snackbarOpen: false,
  //dialogOpen: false,
  message: '', 
};

const handleAction = handleActions({
  [LOGIN]: (state, { payload: uid }) => {
    return {...initialState, uid: uid};
  },
  [LOGOUT]: (state) => {
    return initialState;
  },
  [SNACKBAR]: (state, { payload: data }) => {
    return {...state, snackbarOpen: data.snackbarOpen, message: data.message };
  },  
  [DIALOG_OPEN]: (state, { payload: data }) => {
    let chatWindows = state.chatWindows;
    /*let inx = chatWindows.findIndex(row => row.room.roomid === data.roomid);
    if (inx>-1) {
      //chatWindows[inx].windowHandle.focus();
      return {...state};
    }*/
    return {...state, chatWindows: chatWindows.concat({room:data}) };
  },  
  [DIALOG_SET]: (state, { payload: data }) => {
    let chatWindows = state.chatWindows;
    console.log(data);
    return {...state, chatWindows: chatWindows.map(row => row.room.roomid === data.roomid ? {room: row.room, chatlistener: data.chatlistener}: row) };
  },
  [DIALOG_CLOSE]: (state, { payload: data }) => {
    let chatWindows = state.chatWindows;
    return {...state, chatWindows: chatWindows.filter(row => row.room.roomid !== data) };
  },  
  // =================================
  [USER_LIST]: (state, { payload: data }) => {
    return {...state, users: data };
  },
  [USER_SAVE]: (state, { payload: data }) => {
    let users = state.users;
    let inx = users.findIndex(row => row.uid === data.uid);
    if (inx===-1) {                                                       // new : Insert
      //let newusers = [{date: new Date(), ...data }]
      let newusers = [{date: new Date(), ...data }]
      return {...state, users: newusers.concat(users) };
    } else {                                                              // Update
      return {...state, users: users.map(row => data.uid === row.uid ? {...data }: row) };
    }  
  },
  [USER_ADDS]: (state, { payload: data }) => {
    let users = state.users;
    return {...state, users: data.concat(users) };
  },
  [USER_REMOVE]: (state, { payload: uid }) => {
    let users = state.users;
    return {...state, users: users.filter(row => row.uid !== uid) };
  },
  [USER_ADDPHOTO]: (state, { payload: data }) => {
    let users = state.users;    
    let inx = users.findIndex(row => row.uid === data.uid);
    if (inx > -1) {         
      users[inx].photourl = data.photourl;
      return {...state, users: users};
    };
  },
  // =================================
  [ROOMS_LIST]: (state, { payload: data }) => {
    return {...state, rooms: data, selectedRoom: {} };
  },
  [ROOMS_SAVE]: (state, { payload: data }) => {
    if (state.selectedRoom.roomid!==data.roomid){
      state.unreadcount ++;
    }

    let rooms = state.rooms;
    let inx = rooms.findIndex(row => row.roomid === data.roomid);
    if (inx===-1) {                                                       // new : Insert
      let newrooms = [{date: new Date(), ...data }]
      return {...state, rooms: newrooms.concat(rooms) };
    } else {                                                              // Update
      return {...state, rooms: rooms.map(row => data.roomid === row.roomid ? {...data }: row) };
    }  
  },
  [ROOMS_ADDS]: (state, { payload: data }) => {
    let rooms = state.rooms;
    return {...state, rooms: data.concat(rooms) };
  },
  [ROOMS_REMOVE]: (state, { payload: roomid }) => {
    let rooms = state.rooms;
    return {...state, rooms: rooms.filter(row => row.roomid !== roomid), selectedRoom: {} };
  },
  [ROOMS_READ]: (state, { payload: roomInfo }) => {
    return {...state, selectedRoom: roomInfo};    
  },
  [UNREADCOUNT]: (state, { payload: count }) => {
    return {...state, unreadcount: count};    
  }, 
  // =================================
  /*
  [CHAT_LIST]: (state, { payload: data }) => {
    return {...state, chattings: data };
  },
  [CHAT_ADDS]: (state, { payload: data }) => {
    let chattings = state.chattings;
    return {...state, chattings: chattings.concat(data) };
  },
  [CHAT_INIT]: (state, { payload: room }) => {
    return {...state, chattings: [], selectedRoom: room };
  },
  [CHAT_SAVE]: (state, { payload: data }) => {
    let chattings = state.chattings;
    let inx = chattings.findIndex(row => row.chatid === data.chatid);
    if (inx>-1) {                                                     
      return {...state, chattings: chattings.map(row => data.chatid === row.chatid ? {...data }: row) };
    }  
  },  */
  [UNREADCOUNT]: (state, { payload: count }) => {
    return {...state, unreadcount: count};  
  }  
}, initialState);


export default handleAction;

