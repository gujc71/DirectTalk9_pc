import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';

import UsersIcon from '@material-ui/icons/Group';
import RoomsIcon from '@material-ui/icons/Forum';
import PersonIcon from '@material-ui/icons/Person';

import MySnackbar from "./mycom/MySnackbar";
import UserList from './UserList';
import RoomList from './RoomList';
import UserProfile from './UserProfile';
import SignIn from './SignIn'; 

import {login, firebase_user_list, firebase_rooms_list} from '../reducer/App_reducer';
import {firebaseAuth} from '../reducer/Firestore';

const styles = theme => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
  },
  tabsRoot: {
    borderBottom: '1px solid #e8e8e8',
  },
  tabsIndicator: {
    backgroundColor: '#1890ff',
  },
  tabRoot: {
    textTransform: 'initial',
    minWidth: 72,
    fontWeight: theme.typography.fontWeightRegular,
    marginRight: theme.spacing.unit * 4,
    '&:hover': {
      color: '#40a9ff',
      opacity: 1,
    },
    '&$tabSelected': {
      color: '#1890ff',
      fontWeight: theme.typography.fontWeightMedium,
    },
    '&:focus': {
      color: '#40a9ff',
    },
  },
  tabSelected: {},
  typography: {
    padding: theme.spacing.unit * 3,
  },
});

class Main extends React.Component {
  state = {
    value: 0,
    loading: true
  }
  
  componentDidMount () {
    this.removeListener = firebaseAuth.onAuthStateChanged((user) => {
      if (user) {
           this.props.login(user.uid);
           this.props.firebase_user_list();
      }else this.props.login(null);
    })
  }
  
  componentWillReceiveProps(nextProps) {
    if (!this.state.loading & this.props.users.length===0) return;
    if (!this.state.loading) return;

    this.props.firebase_rooms_list();
    this.setState({loading: false});
  }

  componentWillUnmount () {
    this.removeListener()
  }

  handleTabChange = (event, value) => {
    this.setState({ value: value });
  };

  render() {
    const { classes, uid } = this.props;
    const { value } = this.state;

    return (
      <div className={classes.root}>
        <Tabs value={value} onChange={this.handleTabChange} classes={{ root: classes.tabsRoot, indicator: classes.tabsIndicator }} centered>
          <Tab icon={<UsersIcon/>} disableRipple classes={{ root: classes.tabRoot, selected: classes.tabSelected }}/>
          <Tab icon={<RoomsIcon/>} disableRipple classes={{ root: classes.tabRoot, selected: classes.tabSelected }} />
          <Tab icon={<PersonIcon/>} disableRipple classes={{ root: classes.tabRoot, selected: classes.tabSelected }} />
        </Tabs>
        <div>
          {uid!==null 
            ? <div>
                {value === 0 && <UserList/>}
                {value === 1 && <RoomList/>}
                {value === 2 && <UserProfile/>}
              </div>
            : <SignIn/>  
          }
        </div>
        <MySnackbar />
      </div>
    );
  }
}

Main.propTypes = {
  classes: PropTypes.object.isRequired,
};

let mapStateToProps = (state) => {
  return {
    uid: state.uid,
    users: state.users,
  };
}

const mapDispatchToProps = dispatch => ({
login: uid => dispatch(login(uid)),
firebase_user_list: () => dispatch(firebase_user_list()),
firebase_rooms_list: () => dispatch(firebase_rooms_list()),
})

export default connect(mapStateToProps, mapDispatchToProps) (withStyles(styles)(Main));