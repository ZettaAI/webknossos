import { Link } from "react-router-dom";
// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module '@sca... Remove this comment to see the full error message
import { PropTypes } from "@scalableminds/prop-types";
import { Table, Tag, Spin, Button, Input, Modal, Card, Alert } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  ForkOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import React from "react";
import _ from "lodash";
import features from "features";
import { AsyncLink } from "components/async_clickables";
import type { APITask, APITaskType, APIUser, TaskStatus } from "types/api_flow_types";
import { deleteTask, getTasks, downloadAnnotation, assignTaskToUser } from "admin/admin_rest_api";
import { formatTuple, formatSeconds } from "libs/format_utils";
import { handleGenericError } from "libs/error_handling";
import FormattedDate from "components/formatted_date";
import Persistence from "libs/persistence";
import TaskAnnotationView from "admin/task/task_annotation_view";
import LinkButton from "components/link_button";
import { downloadTasksAsCSV } from "admin/task/task_create_form_view";
import type { QueryObject, TaskFormFieldValues } from "admin/task/task_search_form";
import TaskSearchForm from "admin/task/task_search_form";
import Toast from "libs/toast";
import * as Utils from "libs/utils";
import messages from "messages";
import FixedExpandableTable from "components/fixed_expandable_table";
import UserSelectionComponent from "admin/user/user_selection_component";
const { Column } = Table;
const { Search, TextArea } = Input;
type Props = {
  initialFieldValues?: TaskFormFieldValues;
};
type State = {
  isLoading: boolean;
  tasks: Array<APITask>;
  users: APIUser[];
  searchQuery: string;
  selectedUserIdForAssignment: string | null;
  isAnonymousTaskLinkModalOpen: boolean;
};
const typeHint: Array<APITask> = [];
const persistence = new Persistence<Pick<State, "searchQuery">>(
  {
    searchQuery: PropTypes.string,
  },
  "taskList",
);

class TaskListView extends React.PureComponent<Props, State> {
  state: State = {
    isLoading: false,
    tasks: [],
    users: [],
    searchQuery: "",
    selectedUserIdForAssignment: null,
    isAnonymousTaskLinkModalOpen: Utils.hasUrlParam("showAnonymousLinks"),
  };

  componentDidMount() {
    // @ts-ignore
    this.setState(persistence.load());
  }

  componentDidUpdate() {
    persistence.persist(this.state);
  }

  async fetchData(queryObject: QueryObject) {
    if (!_.isEmpty(queryObject)) {
      this.setState({
        isLoading: true,
      });

      try {
        const tasks = await getTasks(queryObject);
        this.setState({
          tasks,
        });
      } catch (error) {
        handleGenericError(error as Error);
      } finally {
        this.setState({
          isLoading: false,
        });
      }
    } else {
      this.setState({
        tasks: [],
      });
    }
  }

  handleSearch = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({
      searchQuery: event.target.value,
    });
  };

  deleteTask = (task: APITask) => {
    Modal.confirm({
      title: messages["task.delete"],
      onOk: async () => {
        try {
          this.setState({
            isLoading: true,
          });
          await deleteTask(task.id);
          this.setState((prevState) => ({
            tasks: prevState.tasks.filter((t) => t.id !== task.id),
          }));
        } catch (error) {
          handleGenericError(error as Error);
        } finally {
          this.setState({
            isLoading: false,
          });
        }
      },
    });
  };

  assignTaskToUser = (task: APITask) => {
    Modal.confirm({
      title: "Manual Task Assignment",
      icon: <UserAddOutlined />,
      width: 500,
      content: (
        <>
          <div>Please, select a user to manually assign this task to:</div>
          <div style={{ marginTop: 10, marginBottom: 25 }}>
            <UserSelectionComponent
              handleSelection={(value) => this.setState({ selectedUserIdForAssignment: value })}
            />
          </div>
          <Alert
            message="Note, manual assignments will bypass the automated task distribution system and its checks for user experience, access rights and other eligibility criteria."
            type="info"
          />
        </>
      ),
      onOk: async () => {
        const userId = this.state.selectedUserIdForAssignment;
        if (userId != null) {
          try {
            const updatedTask = await assignTaskToUser(task.id, userId);
            this.setState((prevState) => ({
              tasks: [...prevState.tasks.filter((t) => t.id !== task.id), updatedTask],
            }));

            Toast.success("A user was successfully assigned to the task.");
          } catch (error) {
            handleGenericError(error as Error);
          } finally {
            this.setState({ selectedUserIdForAssignment: null });
          }
        }
      },
    });
  };

  getFilteredTasks = () => {
    const { searchQuery, tasks } = this.state;
    return Utils.filterWithSearchQueryAND(
      tasks,
      [
        "team",
        "projectName",
        "id",
        "dataSet",
        "created",
        "type",
        (task) => task.neededExperience.domain,
      ],
      searchQuery,
    );
  };

  downloadSettingsFromAllTasks = async (queryObject: QueryObject) => {
    await this.fetchData(queryObject);
    const filteredTasks = this.getFilteredTasks();

    if (filteredTasks.length > 0) {
      downloadTasksAsCSV(filteredTasks);
    } else {
      Toast.warning(messages["task.no_tasks_to_download"]);
    }
  };

  getAnonymousTaskLinkModal() {
    const anonymousTaskId = Utils.getUrlParamValue("showAnonymousLinks");

    if (!this.state.isAnonymousTaskLinkModalOpen) {
      return null;
    }

    const tasksString = this.state.tasks
      .filter((t) => t.id === anonymousTaskId)
      .map((t) => t.directLinks)
      .join("\n");
    return (
      <Modal
        title={`Anonymous Task Links for Task ${anonymousTaskId}`}
        open={this.state.isAnonymousTaskLinkModalOpen}
        onOk={() => {
          navigator.clipboard
            .writeText(tasksString)
            .then(() => Toast.success("Links copied to clipboard"));
          this.setState({
            isAnonymousTaskLinkModalOpen: false,
          });
        }}
        onCancel={() =>
          this.setState({
            isAnonymousTaskLinkModalOpen: false,
          })
        }
      >
        <TextArea
          autoSize={{
            minRows: 2,
            maxRows: 10,
          }}
          defaultValue={tasksString}
        />
      </Modal>
    );
  }

  renderPlaceholder() {
    return (
      <>
        <p>
          There are no tasks in the current search. Select search criteria above or create new tasks
          by clicking on the <strong>Add Task</strong> button.
        </p>
        <p>
          To learn more about the task system in WEBKNOSSOS,{" "}
          <a
            href="https://docs.webknossos.org/webknossos/tasks.html"
            rel="noopener noreferrer"
            target="_blank"
          >
            check out the documentation
          </a>
          .
        </p>
      </>
    );
  }

  render() {
    const marginRight = {
      marginRight: 20,
    };
    const { searchQuery, isLoading } = this.state;
    return (
      <div className="container">
        <div className="pull-right">
          <Link to="/tasks/create">
            <Button icon={<PlusOutlined />} style={marginRight} type="primary">
              Add Task
            </Button>
          </Link>
          <Search
            style={{
              width: 200,
            }}
            onChange={this.handleSearch}
            value={searchQuery}
          />
        </div>
        <h3
          style={{
            display: "inline-block",
            verticalAlign: "top",
          }}
        >
          Tasks
        </h3>
        {features().isWkorgInstance ? (
          <>
            <a
              href="https://webknossos.org/services/annotations"
              className="crosslink-box"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background:
                  'url("/assets/images/vx/manual-annotations-horizontal.png") center center / 110%',
                height: "73px",
                padding: "0px",
                width: "800px",
                overflow: "hidden",
                display: "inline-block",
                marginLeft: "100px",
                marginBottom: 0,
                opacity: "0.9",
                marginTop: 0,
              }}
            >
              <div
                style={{
                  padding: "10px 170px",
                  background:
                    "linear-gradient(181deg, #1414147a, rgb(59 59 59 / 45%), rgba(20, 19, 31, 0.84))",
                }}
              >
                <h4
                  style={{
                    color: "white",
                    textAlign: "center",
                  }}
                >
                  Need more workforce for annotating your dataset?
                  <br />
                  Have a look at our annotation services.
                </h4>
              </div>
            </a>
            <div
              className="clearfix"
              style={{
                margin: "20px 0px",
              }}
            />
          </>
        ) : null}

        <Card title="Search for Tasks">
          <TaskSearchForm
            onChange={(queryObject) => this.fetchData(queryObject)}
            initialFieldValues={this.props.initialFieldValues}
            isLoading={isLoading}
            onDownloadAllTasks={this.downloadSettingsFromAllTasks}
          />
        </Card>

        <Spin spinning={isLoading} size="large">
          <FixedExpandableTable
            dataSource={this.getFilteredTasks()}
            rowKey="id"
            pagination={{
              defaultPageSize: 50,
            }}
            style={{
              marginTop: 30,
              marginBottom: 30,
            }}
            expandable={{
              expandedRowRender: (task) => <TaskAnnotationView task={task} />,
            }}
            locale={{
              emptyText: this.renderPlaceholder(),
            }}
          >
            <Column
              title="ID"
              dataIndex="id"
              key="id"
              sorter={Utils.localeCompareBy(typeHint, (task) => task.id)}
              className="monospace-id"
              width={100}
            />
            <Column
              title="Project"
              dataIndex="projectName"
              key="projectName"
              width={130}
              sorter={Utils.localeCompareBy(typeHint, (task) => task.projectName)}
              render={(projectName: string) => (
                <a href={`/projects#${projectName}`}>{projectName}</a>
              )}
            />
            <Column
              title="Type"
              dataIndex="type"
              key="type"
              width={200}
              sorter={Utils.localeCompareBy(typeHint, (task) => task.type.summary)}
              render={(taskType: APITaskType) => (
                <a href={`/taskTypes#${taskType.id}`}>{taskType.summary}</a>
              )}
            />
            <Column
              title="Dataset"
              dataIndex="dataSet"
              key="dataSet"
              sorter={Utils.localeCompareBy(typeHint, (task) => task.dataSet)}
            />
            <Column
              title="Stats"
              dataIndex="status"
              key="status"
              render={(status, task: APITask) => (
                <div className="nowrap">
                  <span title="Pending Instances">
                    <PlayCircleOutlined />
                    {status.pending}
                  </span>
                  <br />
                  <span title="Active Instances">
                    <ForkOutlined />
                    {status.active}
                  </span>
                  <br />
                  <span title="Finished Instances">
                    <CheckCircleOutlined />
                    {status.finished}
                  </span>
                  <br />
                  <span title="Annotation Time">
                    <ClockCircleOutlined />
                    {formatSeconds((task.tracingTime || 0) / 1000)}
                  </span>
                </div>
              )}
              filters={[
                {
                  text: "Has Pending Instances",
                  value: "pending",
                },
                {
                  text: "Has Active Instances",
                  value: "active",
                },
                {
                  text: "Has Finished Instances",
                  value: "finished",
                },
              ]}
              onFilter={(key, task: APITask) => task.status[key as unknown as keyof TaskStatus] > 0}
            />
            <Column
              title="Edit Position / Bounding Box"
              dataIndex="editPosition"
              key="editPosition"
              width={150}
              render={(__, task: APITask) => (
                <div className="nowrap">
                  {formatTuple(task.editPosition)} <br />
                  <span>{formatTuple(task.boundingBoxVec6)}</span>
                </div>
              )}
            />
            <Column
              title="Experience"
              dataIndex="neededExperience"
              key="neededExperience"
              sorter={Utils.localeCompareBy(typeHint, (task) => task.neededExperience.domain)}
              width={250}
              render={(neededExperience) =>
                neededExperience.domain !== "" || neededExperience.value > 0 ? (
                  <Tag>
                    {neededExperience.domain} : {neededExperience.value}
                  </Tag>
                ) : null
              }
            />
            <Column
              title="Creation Date"
              dataIndex="created"
              key="created"
              width={200}
              sorter={Utils.compareBy(typeHint, (task) => task.created)}
              render={(created) => <FormattedDate timestamp={created} />}
            />
            <Column
              title="Action"
              key="actions"
              width={170}
              fixed="right"
              render={(__, task: APITask) => (
                <>
                  {task.status.finished > 0 ? (
                    <div>
                      <a
                        href={`/annotations/CompoundTask/${task.id}`}
                        title="View all Finished Annotations"
                      >
                        <EyeOutlined />
                        View
                      </a>
                    </div>
                  ) : null}
                  <div>
                    <a href={`/tasks/${task.id}/edit`} title="Edit Task">
                      <EditOutlined />
                      Edit
                    </a>
                  </div>
                  {task.status.pending > 0 ? (
                    <div>
                      <LinkButton onClick={_.partial(this.assignTaskToUser, task)}>
                        <UserAddOutlined />
                        Manually Assign to User
                      </LinkButton>
                    </div>
                  ) : null}
                  {task.status.finished > 0 ? (
                    <div>
                      <AsyncLink
                        href="#"
                        onClick={() => {
                          const includesVolumeData = task.type.tracingType !== "skeleton";
                          return downloadAnnotation(task.id, "CompoundTask", includesVolumeData);
                        }}
                        title="Download all Finished Annotations"
                        icon={<DownloadOutlined />}
                      >
                        Download
                      </AsyncLink>
                    </div>
                  ) : null}
                  <div>
                    <LinkButton onClick={_.partial(this.deleteTask, task)}>
                      <DeleteOutlined />
                      Delete
                    </LinkButton>
                  </div>
                </>
              )}
            />
          </FixedExpandableTable>
          {this.getAnonymousTaskLinkModal()}
        </Spin>
      </div>
    );
  }
}

export default TaskListView;
