import React from "react";
import { RouteComponentProps, withRouter } from "react-router-dom";
import { Form, Input, Button, Col, Row } from "antd";
import { MailOutlined } from "@ant-design/icons";
import Request from "libs/request";
import messages from "messages";
import Toast from "libs/toast";
const FormItem = Form.Item;
type Props = {
  history: RouteComponentProps["history"];
};

function StartResetPasswordView({ history }: Props) {
  const [form] = Form.useForm();

  const onFinish = (formValues: Record<string, any>) => {
    Request.sendJSONReceiveJSON("/api/auth/startResetPassword", {
      data: formValues,
    }).then(() => {
      Toast.success(messages["auth.reset_email_notification"]);
      history.push("/");
    });
  };

  return (
    <Row className="login-view" justify="center" align="middle">
      <Col className="login-content">
        <h3>Reset Password</h3>
        <Form onFinish={onFinish} form={form}>
          <FormItem
            name="email"
            rules={[
              {
                required: true,
                type: "email",
                message: messages["auth.registration_email_input"],
              },
            ]}
          >
            <Input
              prefix={
                <MailOutlined
                  style={{
                    fontSize: 13,
                  }}
                />
              }
              placeholder="Email"
            />
          </FormItem>
          <FormItem>
            <Button
              type="primary"
              htmlType="submit"
              style={{
                width: "100%",
              }}
            >
              Send Reset Email
            </Button>
          </FormItem>
        </Form>
      </Col>
    </Row>
  );
}

export default withRouter<RouteComponentProps & Props, any>(StartResetPasswordView);
