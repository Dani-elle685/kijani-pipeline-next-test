pipeline {
    // agent {
    //     docker {
    //         image 'node:18-alpine'
    //         args  '-v /tmp:/tmp'
    //     }
    // }

    agent any

    tools {
        nodejs 'NodeJS 22'
    }

    environment {
        NODE_ENV  = 'test'
        BUILD_DIR = 'dist'  
        APP_NAME  = 'kijanikiosk-payments'
        NEXUS_URL = 'http://localhost:8081/repository/npm-kijanikiosk-test/'
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Initialize') {
            steps {
                script {
                    env.PKG_VERSION = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
                    env.GIT_SHORT   = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.ARTIFACT_VERSION = "${env.PKG_VERSION}-${env.GIT_SHORT}"
                    
                    echo "Initialized pipeline for ${APP_NAME} v${env.ARTIFACT_VERSION}"
                }
            }
        }

        stage('Install') {
            steps {
                echo "Installing clean dependencies for ${APP_NAME}..."
                sh 'npm ci'
            }
        }

        stage('Lint') {
            steps {
                echo "Running linter for ${APP_NAME}..."
                sh 'npm run lint --if-present'
            }
        }

        stage('Build') {
            steps {

                echo "Building application..."
                sh 'npm run build'

                echo "Verifying build output..."
                sh '''
                    set -e
                    test -d "${BUILD_DIR}" || { echo "ERROR: build directory '${BUILD_DIR}' not found"; exit 1; }
                    echo "Build output verified: $(ls ${BUILD_DIR} | wc -l) files found."
                '''
                
                echo "Stashing compilation output for concurrent tracking stages..."
                stash name: 'compiled-assets', includes: "${BUILD_DIR}/**"
            }
        }

        stage('Verify') {
            parallel {
                stage('Test') {
                    steps {
                        echo "Unstashing build output..."
                        unstash 'compiled-assets'
                        
                        echo "Running unit test suite..."
                        sh '''
                            set -e
                            npm test
                        '''
                    }
                    post {
                        always {
                            // Publish JUnit results for test metrics reporting
                            junit allowEmptyResults: true,
                                  testResults: 'test-results/*.xml'
                        }
                    }
                }
                stage('Security Audit') {
                    steps {
                        echo "Scanning package dependencies for high vulnerabilities..."
                        // Scans package-lock.json without needing to unstash the build distribution folder
                        sh 'npm audit --audit-level=high'
                    }
                }
            }
        }

        stage('Archive') {
            steps {
                echo "Archiving workspace artifacts securely for build ${BUILD_NUMBER}..."
                archiveArtifacts artifacts: "${BUILD_DIR}/**",
                                 fingerprint: true,
                                 onlyIfSuccessful: true
                echo "Artifacts preserved. Access from: ${BUILD_URL}artifact/"
            }
        }

        stage('Publish') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'nexus-credentials',
                    usernameVariable: 'NEXUS_USER',
                    passwordVariable: 'NEXUS_PASS'
                )]) {
                    sh '''
                        set -e
                        
                        # Guarantee cleanup of .npmrc containing raw tokens even if steps fail
                        trap "rm -f .npmrc" EXIT

                        # Generate base64 token from injected credentials
                        NEXUS_TOKEN=$(echo -n "${NEXUS_USER}:${NEXUS_PASS}" | base64)

                        # Strip protocol from NEXUS_URL to cleanly format the .npmrc auth key matching
                        NEXUS_REGISTRY_PATH=$(echo "${NEXUS_URL}" | sed 's/^https\\?://')

                        # Write secure temporary configurations
                        cat > .npmrc << NPMRC
                        registry=${NEXUS_URL}
                        ${NEXUS_REGISTRY_PATH}:_auth="${NEXUS_TOKEN}"
                        ${NEXUS_REGISTRY_PATH}:always-auth=true
                        NPMRC

                        # Synchronize package.json with the generated unique pipeline artifact version
                        npm version ${ARTIFACT_VERSION} --no-git-tag-version

                        # Publish to target local Sonatype Nexus engine
                        npm publish
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded! Release Version ${env.ARTIFACT_VERSION} successfully uploaded to ${NEXUS_URL}"
        }
        failure {
            echo "Pipeline FAILED: ${APP_NAME} build #${BUILD_NUMBER}. Inspect full execution paths at: ${BUILD_URL}console"
        }
        changed {
            echo "Build execution matrix state changed to: ${currentBuild.currentResult} - ${JOB_NAME} #${BUILD_NUMBER}"
        }
        always {
            echo "Tearing down transient container workspace context..."
            cleanWs()
        }
    }
}