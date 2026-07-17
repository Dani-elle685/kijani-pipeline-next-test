pipeline {
    agent {
        docker {
            image 'node:22-slim'
            args  '--network=host -v /tmp:/tmp'
        }
    }


    environment {
        NODE_ENV  = 'test'
        BUILD_DIR = '.next'  
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
                echo "Installing dependencies for ${APP_NAME}..."
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
                echo "Building application assets..."
                sh 'npm run build'

                echo "Verifying build output compilation directory..."
                sh '''
                    set -e
                    test -d "${BUILD_DIR}" || { echo "ERROR: build directory '${BUILD_DIR}' not found"; exit 1; }
                    echo "Build output verified: $(ls ${BUILD_DIR} | wc -l) files found."
                '''
                
                echo "Stashing assets for down-stream validation tracks..."
                stash name: 'compiled-assets', includes: "${BUILD_DIR}/**,package.json,package-lock.json"
            }
        }

        stage('Verify') {
            parallel {
                stage('Test') {
                    steps {
                        echo "Unstashing assets for test run..."
                        unstash 'compiled-assets'
                        
                        echo "Running unit test suite..."
                        sh '''
                            set -e
                            npm test
                        '''
                    }
                    post {
                        always {
                            junit allowEmptyResults: true,
                                  testResults: 'test-results/*.xml'
                        }
                    }
                }
                stage('Security Audit') {
                    steps {
                        echo "Running vulnerability scan on open-source dependencies..."
                        sh 'npm audit --audit-level=high'
                    }
                }
            }
        }

        stage('Archive') {
            steps {
                echo "Archiving compilation output artifacts with finger-printing..."
                archiveArtifacts artifacts: "${BUILD_DIR}/**",
                                 fingerprint: true,
                                 onlyIfSuccessful: true
                echo "Archived locally at: ${BUILD_URL}artifact/"
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
                        
                        # Requirement 1: Scrapes temporary auth records instantly if runtime drops out
                        trap "rm -f .npmrc" EXIT

                        # Generate authentication payload from injected credentials
                        NEXUS_TOKEN=$(echo -n "${NEXUS_USER}:${NEXUS_PASS}" | base64)
                        
                        # Strip protocol prefix to match .npmrc registry declaration structures
                        NEXUS_REGISTRY_PATH=$(echo "${NEXUS_URL}" | sed 's/^http[s]*://')

                        # Write local runtime configurations 
                        cat > .npmrc << NPMRC
                        registry=${NEXUS_URL}
                        ${NEXUS_REGISTRY_PATH}:_auth="${NEXUS_TOKEN}"
                        ${NEXUS_REGISTRY_PATH}:always-auth=true
                        NPMRC

                        # Requirement 2: Dynamically re-tag package.json configuration target properties
                        npm version ${ARTIFACT_VERSION} --no-git-tag-version

                        echo "Uploading application package to target Nexus Engine..."
                        npm publish --registry=${NEXUS_URL}
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded! Release version ${env.ARTIFACT_VERSION} is safely hosted at: ${env.NEXUS_URL}"
        }
        failure {
            echo "Pipeline FAILED: ${APP_NAME} build #${BUILD_NUMBER}. Review execution context breakdowns at: ${BUILD_URL}console"
        }
        changed {
            echo "Build state transition discovered. Status changed to: ${currentBuild.currentResult} for job ${JOB_NAME} #${BUILD_NUMBER}"
        }
        always {
            echo "Purging workspace context trees from host workspace system..."
            cleanWs()
        }
    }
}