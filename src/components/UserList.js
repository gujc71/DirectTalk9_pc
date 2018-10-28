import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import { withStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Avatar from '@material-ui/core/Avatar';
import WorkIcon from '@material-ui/icons/PermIdentity';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';

import styles from './mycom/styles4List';
import {dialog_open} from '../reducer/App_reducer';

class Listview extends React.Component {
  handleUserClick = (user) => {
    this.props.dispatch(dialog_open(user) );
  }

  render() {
    const { classes, users, uid } = this.props;

    return (
      <div className={classes.root}>
        <List className={classes.list}>
              {
                  users.map((row, inx) => (
                    row.uid !== uid &&
                      <ListItem button key={inx} onClick={this.handleUserClick.bind(this, row)}>
                        <Avatar className={classes.Avata}>
                          { row.photourl 
						                  ? <img src={row.photourl} alt="Profile" className={classes.Image}/>
                              : <WorkIcon/>
                          }
                        </Avatar>
                        <ListItemText primary={row.usernm} />
                          
                        <ListItemSecondaryAction className={classes.ListItemSecondaryAction}>
                          <ListItemText primary={row.usermsg}/>
                        </ListItemSecondaryAction>          
                      </ListItem>
                  ))
              }          
        </List>
      </div>
    );
  }
}

Listview.propTypes = {
  classes: PropTypes.object.isRequired,
};

let mapStateToProps = (state) => {
  return {
    uid: state.uid,
    users: state.users,
  };
}

export default connect(mapStateToProps)(withStyles(styles)(Listview));
