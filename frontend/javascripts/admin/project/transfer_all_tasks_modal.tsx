import { Modal, Button, Table, Spin } from "antd";
import * as React from "react";
import _ from "lodash";
import type { APIUser, APIProject, APIActiveUser } from "types/api_flow_types";
import {
  getUsers,
  getUsersWithActiveTasks,
  transferActiveTasksOfProject,
} from "admin/admin_rest_api";
import { handleGenericError } from "libs/error_handling";
import Toast from "libs/toast";
import UserSelectionComponent from "admin/user/user_selection_component";
import messages from "messages";
type Props = {
  project: APIProject | null | undefined;
  onCancel: () => void;
  onComplete: () => void;
};
type State = {
  users: Array<APIUser>;
  selectedUser: APIUser | null | undefined;
  usersWithActiveTasks: Array<APIActiveUser>;
  isLoading: boolean;
};

class TransferAllTasksModal extends React.PureComponent<Props, State> {
  state: State = {
    users: [],
    selectedUser: null,
    usersWithActiveTasks: [],
    isLoading: false,
  };

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    try {
      this.setState({
        isLoading: true,
      });
      const users = await getUsers();
      const activeUsers = users.filter((u) => u.isActive);
      const usersWithActiveTasks = this.props.project
        ? await getUsersWithActiveTasks(this.props.project.id)
        : [];

      const sortedUsers = _.sortBy(activeUsers, "lastName");

      this.setState({
        users: sortedUsers,
        usersWithActiveTasks,
      });
    } catch (error) {
      handleGenericError(error as Error);
    } finally {
      this.setState({
        isLoading: false,
      });
    }
  }

  transferAllActiveTasks = async () => {
    if (!this.state.selectedUser || !this.props.project) {
      return;
    }

    try {
      const selectedUser = this.state.selectedUser;
      await transferActiveTasksOfProject(this.props.project.id, selectedUser.id);

      if (selectedUser) {
        Toast.success(
          `${messages["project.successful_active_tasks_transfer"]} ${selectedUser.lastName}, ${selectedUser.firstName}`,
        );
      }

      this.props.onComplete();
    } catch (_e) {
      Toast.error(messages["project.unsuccessful_active_tasks_transfer"]);
    }
  };

  renderTableContent() {
    const activeUsersWithKey = this.state.usersWithActiveTasks.map((activeUser) => ({
      email: activeUser.email,
      firstName: activeUser.firstName,
      lastName: activeUser.lastName,
      activeTasks: activeUser.activeTasks,
      key: activeUser.email,
    }));
    const columns = [
      {
        title: "User",
        dataIndex: "email",
        render: (email: string, record: APIActiveUser) =>
          `${record.lastName}, ${record.firstName} (${email})`,
        key: "email",
      },
      {
        title: "Number of Active Tasks",
        dataIndex: "activeTasks",
        key: "activeTasks",
      },
    ];
    return (
      <Table
        columns={columns}
        dataSource={activeUsersWithKey}
        rowKey="email"
        pagination={false}
        size="small"
      />
    );
  }

  handleSelectChange = (userId: string) => {
    this.setState((prevState) => {
      const selectedUser = prevState.users.find((user) => user.id === userId);
      return {
        selectedUser,
      };
    });
  };

  render() {
    const project = this.props.project;

    if (!project) {
      return (
        <Modal title="Error" open onOk={this.props.onCancel} onCancel={this.props.onCancel}>
          <p>{messages["project.none_selected"]}</p>
        </Modal>
      );
    } else {
      const title = `All users with active tasks for ${project.name}`;
      return (
        <Modal
          title={title}
          open
          onCancel={this.props.onCancel}
          // @ts-expect-error ts-migrate(2322) FIXME: Type '{ children: (string | Element)[]; title: str... Remove this comment to see the full error message
          pagination="false"
          footer={
            <div>
              <Button
                type="primary"
                disabled={!this.state.selectedUser}
                onClick={this.transferAllActiveTasks}
              >
                Transfer all tasks
              </Button>
              <Button onClick={this.props.onCancel}>Close</Button>
            </div>
          }
        >
          <div>
            {this.state.isLoading ? <Spin size="large" /> : this.renderTableContent()}
            <br />
            <br />
          </div>
          Select a user to transfer the tasks to:
          <div className="control-group">
            <div className="form-group">
              <UserSelectionComponent handleSelection={this.handleSelectChange} />
            </div>
          </div>
        </Modal>
      );
    }
  }
}

export default TransferAllTasksModal;
