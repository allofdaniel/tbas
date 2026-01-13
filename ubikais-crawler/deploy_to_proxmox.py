#!/usr/bin/env python3
"""
Proxmox 서버에 UBIKAIS 크롤러 Docker 컨테이너 배포
"""

import paramiko
from scp import SCPClient
import os

# Proxmox 서버 정보
PROXMOX_HOST = "192.168.50.200"
PROXMOX_USER = "root"
PROXMOX_PASSWORD = "pr12pr34!@"

# 로컬 파일 경로
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))
DOCKER_DIR = os.path.join(LOCAL_DIR, "docker")

# 원격 경로
REMOTE_DIR = "/opt/ubikais-crawler"


def create_ssh_client():
    """SSH 클라이언트 생성"""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(PROXMOX_HOST, username=PROXMOX_USER, password=PROXMOX_PASSWORD)
    return ssh


def upload_files(ssh):
    """파일 업로드"""
    print("=" * 60)
    print("파일 업로드 중...")
    print("=" * 60)

    # 원격 디렉토리 생성
    stdin, stdout, stderr = ssh.exec_command(f"mkdir -p {REMOTE_DIR}")
    stdout.read()

    with SCPClient(ssh.get_transport()) as scp:
        files = ["unified_crawler.py", "auto_crawler.py", "Dockerfile", "docker-compose.yml", "requirements.txt", "deploy.sh"]
        for filename in files:
            local_path = os.path.join(DOCKER_DIR, filename)
            remote_path = f"{REMOTE_DIR}/{filename}"
            print(f"  업로드: {filename}")
            scp.put(local_path, remote_path)

    # deploy.sh 실행 권한 부여
    ssh.exec_command(f"chmod +x {REMOTE_DIR}/deploy.sh")
    print("파일 업로드 완료!")


def install_docker(ssh):
    """Docker 및 docker-compose 설치"""
    print("\n" + "=" * 60)
    print("Docker 설치 확인 및 설치...")
    print("=" * 60)

    # Docker 설치 확인
    stdin, stdout, stderr = ssh.exec_command("which docker")
    if not stdout.read().decode().strip():
        print("Docker 설치 중...")
        commands = [
            "apt-get update",
            "apt-get install -y docker.io docker-compose",
            "systemctl enable docker",
            "systemctl start docker"
        ]
        for cmd in commands:
            print(f"  실행: {cmd}")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            stdout.read()
            err = stderr.read().decode()
            if err and "WARNING" not in err:
                print(f"    주의: {err[:100]}")
    else:
        print("Docker 이미 설치됨")

    # docker-compose 확인
    stdin, stdout, stderr = ssh.exec_command("which docker-compose")
    if not stdout.read().decode().strip():
        print("docker-compose 설치 중...")
        stdin, stdout, stderr = ssh.exec_command("apt-get install -y docker-compose")
        stdout.read()
    else:
        print("docker-compose 이미 설치됨")


def deploy_container(ssh):
    """Docker 컨테이너 배포"""
    print("\n" + "=" * 60)
    print("Docker 컨테이너 배포 중...")
    print("=" * 60)

    commands = [
        f"cd {REMOTE_DIR}",
        "docker-compose down 2>/dev/null || true",
        "docker-compose build --no-cache",
        "docker-compose up -d",
        "sleep 5",
        "docker-compose logs --tail=30"
    ]

    full_command = " && ".join(commands)
    stdin, stdout, stderr = ssh.exec_command(full_command, timeout=600)

    # 출력 스트리밍
    for line in iter(stdout.readline, ""):
        try:
            print(line, end="")
        except UnicodeEncodeError:
            print(line.encode('ascii', 'ignore').decode(), end="")

    error = stderr.read().decode('utf-8', errors='ignore')
    if error:
        print(f"\nSTDERR: {error}")

    print("\n배포 완료!")


def check_status(ssh):
    """컨테이너 상태 확인"""
    print("\n" + "=" * 60)
    print("컨테이너 상태 확인")
    print("=" * 60)

    stdin, stdout, stderr = ssh.exec_command("docker ps -a | grep ubikais")
    output = stdout.read().decode()
    print(output if output else "컨테이너가 없습니다.")

    # 데이터 디렉토리 확인
    stdin, stdout, stderr = ssh.exec_command(f"ls -la {REMOTE_DIR}/data/ 2>/dev/null || echo '데이터 없음'")
    print("\n데이터 디렉토리:")
    print(stdout.read().decode())


def main():
    print("=" * 60)
    print("UBIKAIS 크롤러 Proxmox 배포")
    print(f"대상 서버: {PROXMOX_HOST}")
    print("=" * 60)

    try:
        ssh = create_ssh_client()
        print("SSH 연결 성공!")

        upload_files(ssh)
        install_docker(ssh)
        deploy_container(ssh)
        check_status(ssh)

        ssh.close()

        print("\n" + "=" * 60)
        print("모든 배포 완료!")
        print("=" * 60)
        print("\n유용한 명령어:")
        print(f"  로그 확인: ssh root@{PROXMOX_HOST} 'cd {REMOTE_DIR} && docker-compose logs -f'")
        print(f"  상태 확인: ssh root@{PROXMOX_HOST} 'docker ps | grep ubikais'")
        print(f"  중지:      ssh root@{PROXMOX_HOST} 'cd {REMOTE_DIR} && docker-compose down'")

    except Exception as e:
        print(f"배포 실패: {e}")
        raise


if __name__ == "__main__":
    main()
