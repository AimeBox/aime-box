import React, { useState } from 'react';
import { Button, Modal, Typography } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import { supabase } from '@/main/supabase/supabaseClient';

const { Title } = Typography;

function Login(props: { open: boolean; onClose: () => void }) {
  const { onClose, open } = props;
  //const [visible, setVisible] = useState(_visible);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGithubLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        //redirectTo: `aime-box://auth/callback`,
        //skipBrowserRedirect: true,
      },
    });
    setLoading(false);
    if (error) {
      setErrorMsg(`登录失败: ${error.message}`);
    } else {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      footer={null}
      centered
      width={350}
      onCancel={onClose}
      maskClosable
    >
      <Title level={3}>AI Chat 登录</Title>
      <Button
        type="primary"
        icon={<GithubOutlined />}
        size="large"
        style={{ width: '100%', marginTop: 24 }}
        onClick={handleGithubLogin}
        loading={loading}
      >
        使用 GitHub 登录
      </Button>
      {errorMsg && (
        <div style={{ color: 'red', marginTop: 16 }}>{errorMsg}</div>
      )}
    </Modal>
  );
}

export default Login;
